import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import { trashSchema, type WorkspaceRole } from '#cloud/contract'
import {
  createBetterAuthAdapter,
  createCloudApp,
  parseCloudServerConfig,
  type CloudActor
} from '#cloud/server'
import * as v from 'valibot'

const DAY_MS = 24 * 60 * 60_000

const config = parseCloudServerConfig({
  deployment: 'self-hosted',
  publicURL: 'http://localhost:8787',
  databaseURL: 'postgresql://test:test@localhost/test',
  authSecret: 'integration-test-secret-at-least-32-characters',
  s3Endpoint: 'http://localhost:9000',
  s3Region: 'us-east-1',
  s3Bucket: 'openpencil',
  s3AccessKeyId: 'openpencil',
  s3SecretAccessKey: 'openpencil-secret'
})

const people = {
  alice: { userId: crypto.randomUUID(), email: 'alice@example.com', name: 'Alice' },
  bob: { userId: crypto.randomUUID(), email: 'bob@example.com', name: 'Bob' },
  carol: { userId: crypto.randomUUID(), email: 'carol@example.com', name: 'Carol' }
} satisfies Record<string, CloudActor>

const CreatedDocument = v.object({ document: v.object({ id: v.string() }) })
const ListedDocuments = v.object({ documents: v.array(v.object({ id: v.string() })) })

/** Alice administers a workspace; Bob and Carol join it with the roles a test gives them. */
async function trashApp(roles: Partial<Record<'bob' | 'carol', WorkspaceRole>> = {}) {
  let actor: CloudActor = people.alice
  const runtime = await createCloudTestDatabase()
  const objects = createMemoryObjectStore()
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: createBetterAuthAdapter(config, runtime.database),
    objects: objects.store,
    resolveSession: async () => actor
  })
  await runtime.database
    .insertInto('user')
    .values(
      Object.values(people).map((person) => ({
        id: person.userId,
        name: person.name,
        email: person.email,
        emailVerified: true
      }))
    )
    .execute()
  const workspace = await responseJSON(
    await app.request('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Studio', slug: 'studio' })
    }),
    v.object({ workspace: v.object({ id: v.string() }) })
  )
  const workspaceId = workspace.workspace.id
  for (const person of ['bob', 'carol'] as const) {
    const role = roles[person]
    if (!role) continue
    await runtime.database
      .insertInto('workspaceMember')
      .values({ workspaceId, userId: people[person].userId, role })
      .execute()
  }
  return {
    runtime,
    objects,
    app,
    workspaceId,
    as(person: keyof typeof people) {
      actor = people[person]
    },
    async create(name: string): Promise<string> {
      const created = await responseJSON(
        await app.request(`/api/workspaces/${workspaceId}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        }),
        CreatedDocument
      )
      return created.document.id
    },
    async remove(documentId: string) {
      const response = await app.request(`/api/documents/${documentId}`, { method: 'DELETE' })
      expect(response.status).toBe(204)
    },
    async trash() {
      return (await responseJSON(await app.request('/api/trash'), trashSchema)).documents
    },
    async listed() {
      const response = await app.request(`/api/workspaces/${workspaceId}/documents`)
      return (await responseJSON(response, ListedDocuments)).documents.map((entry) => entry.id)
    },
    restore(documentId: string) {
      return app.request(`/api/trash/${documentId}/restore`, { method: 'POST' })
    },
    purge(documentId: string) {
      return app.request(`/api/trash/${documentId}`, { method: 'DELETE' })
    },
    /** Moves a document's deletion back in time, as if it had waited in Trash. */
    async deletedAgo(documentId: string, ms: number) {
      await runtime.database
        .updateTable('document')
        .set({ deletedAt: new Date(Date.now() - ms) })
        .where('id', '=', documentId)
        .execute()
    },
    /** Gives a document a saved revision, as a save would, and counts its bytes. */
    async withRevision(documentId: string) {
      const storageObjectId = crypto.randomUUID()
      const revisionId = crypto.randomUUID()
      const objectKey = `documents/${workspaceId}/${documentId}/revision.fig`
      await runtime.database
        .insertInto('storageObject')
        .values({
          id: storageObjectId,
          objectKey,
          checksum: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          byteSize: 128,
          contentType: 'application/octet-stream'
        })
        .execute()
      await runtime.database
        .insertInto('documentRevision')
        .values({ id: revisionId, documentId, storageObjectId, createdBy: people.alice.userId })
        .execute()
      await runtime.database
        .updateTable('document')
        .set({ currentRevisionId: revisionId })
        .where('id', '=', documentId)
        .execute()
      await runtime.database
        .insertInto('workspaceStorageUsage')
        .values({ workspaceId, committedBytes: 128 })
        .onConflict((conflict) =>
          conflict.column('workspaceId').doUpdateSet({ committedBytes: 128 })
        )
        .execute()
      return objectKey
    }
  }
}

describe('Cloud Trash', () => {
  test('lists deleted documents with who deleted them, and restores them', async () => {
    const context = await trashApp()
    try {
      const kept = await context.create('Kept')
      const deleted = await context.create('Landing page')
      await context.remove(deleted)
      expect(await context.listed()).toEqual([kept])

      const [entry, ...rest] = await context.trash()
      expect(rest).toEqual([])
      expect(entry).toMatchObject({
        id: deleted,
        workspaceId: context.workspaceId,
        workspaceName: 'Studio',
        name: 'Landing page',
        kind: 'design',
        deletedBy: { name: 'Alice' },
        canPurge: true
      })
      if (!entry) throw new Error('Expected the deleted document in Trash')
      expect(Date.parse(entry.purgeAt) - Date.parse(entry.deletedAt)).toBe(30 * DAY_MS)

      expect((await context.restore(deleted)).status).toBe(204)
      expect(await context.trash()).toEqual([])
      expect((await context.listed()).toSorted()).toEqual([kept, deleted].toSorted())
      const restored = await context.runtime.database
        .selectFrom('document')
        .select(['deletedAt', 'deletedBy'])
        .where('id', '=', deleted)
        .executeTakeFirstOrThrow()
      expect(restored).toEqual({ deletedAt: null, deletedBy: null })
    } finally {
      await context.runtime.close()
    }
  })

  test('keeps documents past retention, or being cleaned, out of reach', async () => {
    const context = await trashApp()
    try {
      const expired = await context.create('Expired')
      const claimed = await context.create('Claimed')
      await context.remove(expired)
      await context.remove(claimed)
      await context.deletedAgo(expired, 30 * DAY_MS + 60_000)
      await context.runtime.database
        .updateTable('document')
        .set({ cleanupClaimId: crypto.randomUUID(), cleanupClaimedAt: new Date() })
        .where('id', '=', claimed)
        .execute()

      expect(await context.trash()).toEqual([])
      expect((await context.restore(expired)).status).toBe(404)
      expect((await context.restore(claimed)).status).toBe(404)
      expect(await context.listed()).toEqual([])
    } finally {
      await context.runtime.close()
    }
  })

  test('lets whoever may delete a document restore it, and only its owner or an admin purge it', async () => {
    const context = await trashApp({ bob: 'editor', carol: 'viewer' })
    try {
      const document = await context.create('Shared')
      await context.remove(document)

      context.as('carol')
      expect(await context.trash()).toEqual([])
      expect((await context.restore(document)).status).toBe(404)
      expect((await context.purge(document)).status).toBe(404)

      context.as('bob')
      const [seen] = await context.trash()
      expect(seen).toMatchObject({ id: document, canPurge: false })
      expect((await context.purge(document)).status).toBe(403)
      expect((await context.restore(document)).status).toBe(204)

      // An editor's own document is theirs to delete for good.
      const own = await context.create('Bob’s draft')
      await context.remove(own)
      expect(await context.trash()).toMatchObject([
        { id: own, deletedBy: { name: 'Bob' }, canPurge: true }
      ])
      expect((await context.purge(own)).status).toBe(204)

      // Someone removed from the workspace sees nothing of its Trash.
      await context.remove(document)
      await context.runtime.database
        .deleteFrom('workspaceMember')
        .where('userId', '=', people.bob.userId)
        .execute()
      expect(await context.trash()).toEqual([])
      expect((await context.restore(document)).status).toBe(404)
    } finally {
      await context.runtime.close()
    }
  })

  test('deletes a document for good through cleanup, returning its storage', async () => {
    const context = await trashApp()
    try {
      const document = await context.create('Heavy')
      const objectKey = await context.withRevision(document)
      await context.remove(document)

      expect((await context.purge(document)).status).toBe(204)
      expect(context.objects.deletedKeys).toEqual([objectKey])
      expect(await context.trash()).toEqual([])
      expect(
        await context.runtime.database
          .selectFrom('document')
          .select('id')
          .where('id', '=', document)
          .executeTakeFirst()
      ).toBeUndefined()
      const usage = await context.runtime.database
        .selectFrom('workspaceStorageUsage')
        .select('committedBytes')
        .where('workspaceId', '=', context.workspaceId)
        .executeTakeFirstOrThrow()
      expect(Number(usage.committedBytes)).toBe(0)
      expect((await context.restore(document)).status).toBe(404)
      expect((await context.purge(document)).status).toBe(404)
    } finally {
      await context.runtime.close()
    }
  })

  test('refuses to purge a live document', async () => {
    const context = await trashApp()
    try {
      const document = await context.create('Live')
      expect((await context.purge(document)).status).toBe(404)
      expect((await context.restore(document)).status).toBe(404)
      expect(await context.listed()).toEqual([document])
    } finally {
      await context.runtime.close()
    }
  })
})
