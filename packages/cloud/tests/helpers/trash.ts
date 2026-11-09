import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import { trashSchema, type WorkspaceRole } from '#cloud/contract'
import {
  createBetterAuthAdapter,
  createCloudApp,
  parseCloudServerConfig,
  type CloudActor,
  type CloudErrorReporter
} from '#cloud/server'
import * as v from 'valibot'

export const DAY_MS = 24 * 60 * 60_000

const baseConfig = {
  deployment: 'self-hosted',
  publicURL: 'http://localhost:8787',
  databaseURL: 'postgresql://test:test@localhost/test',
  authSecret: 'integration-test-secret-at-least-32-characters',
  s3Endpoint: 'http://localhost:9000',
  s3Region: 'us-east-1',
  s3Bucket: 'openpencil',
  s3AccessKeyId: 'openpencil',
  s3SecretAccessKey: 'openpencil-secret'
}

export const people = {
  alice: { userId: crypto.randomUUID(), email: 'alice@example.com', name: 'Alice' },
  bob: { userId: crypto.randomUUID(), email: 'bob@example.com', name: 'Bob' },
  carol: { userId: crypto.randomUUID(), email: 'carol@example.com', name: 'Carol' }
} satisfies Record<string, CloudActor>

const CreatedDocument = v.object({ document: v.object({ id: v.string() }) })
const ListedDocuments = v.object({ documents: v.array(v.object({ id: v.string() })) })

export type TrashAppOptions = {
  /** Bob and Carol join the workspace with these roles. */
  roles?: Partial<Record<'bob' | 'carol', WorkspaceRole>>
  /** How long a document deleted forever waits; the deployment default, 7 days, when not given. */
  purgeGraceMs?: number
  reportError?: CloudErrorReporter
}

/**
 * A Cloud app where Alice administers a workspace, Studio, and Bob and Carol join it with the
 * roles a test gives them; each call acts as whoever `as` picked, Alice first.
 */
export async function trashApp({ roles = {}, purgeGraceMs, reportError }: TrashAppOptions = {}) {
  let actor: CloudActor = people.alice
  const config = parseCloudServerConfig({
    ...baseConfig,
    ...(purgeGraceMs === undefined ? {} : { documentPurgeGraceMs: purgeGraceMs })
  })
  const runtime = await createCloudTestDatabase()
  const objects = createMemoryObjectStore()
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: createBetterAuthAdapter(config, runtime.database),
    objects: objects.store,
    resolveSession: async () => actor,
    reportError
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
      if (response.status !== 204) throw new Error(`Deleting answered ${response.status}`)
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
    /** The workspace's recorded storage usage, in bytes. */
    async usage(): Promise<number> {
      const usage = await runtime.database
        .selectFrom('workspaceStorageUsage')
        .select('committedBytes')
        .where('workspaceId', '=', workspaceId)
        .executeTakeFirst()
      return Number(usage?.committedBytes ?? 0)
    },
    /** The document's row, or undefined once cleanup destroyed it. */
    row(documentId: string) {
      return runtime.database
        .selectFrom('document')
        .select(['id', 'deletedAt', 'purgedAt', 'purgedBy', 'purgedBytes'])
        .where('id', '=', documentId)
        .executeTakeFirst()
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
    async withRevision(documentId: string, file = 'revision') {
      const storageObjectId = crypto.randomUUID()
      const revisionId = crypto.randomUUID()
      const objectKey = `documents/${workspaceId}/${documentId}/${file}.fig`
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
          conflict.column('workspaceId').doUpdateSet((expression) => ({
            committedBytes: expression('workspaceStorageUsage.committedBytes', '+', 128)
          }))
        )
        .execute()
      return objectKey
    }
  }
}
