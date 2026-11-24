import { describe, expect, test } from 'bun:test'

import { contractClient, outcome } from '#cloud-tests/helpers/contract'
import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  createCloudApp,
  createBetterAuthAdapter,
  createDocumentService,
  parseCloudServerConfig,
  type CloudActor
} from '#cloud/server'
import { testClient } from 'hono/testing'
import * as v from 'valibot'

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

const actor: CloudActor = {
  userId: 'alice',
  email: 'alice@example.com',
  name: 'Alice'
}
const checksum = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

async function testApp(initialActor: CloudActor = actor) {
  let currentActor = initialActor
  const runtime = await createCloudTestDatabase()
  const objects = createMemoryObjectStore()
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: createBetterAuthAdapter(config, runtime.database),
    objects: objects.store,
    resolveSession: async () => currentActor
  })
  const client = testClient(app)
  const workspaceResponse = await client.api.workspaces.$post({
    json: { name: 'Documents', slug: 'documents-team' }
  })
  const workspace = await responseJSON(
    workspaceResponse,
    v.object({ workspace: v.object({ id: v.string() }) })
  )
  return {
    runtime,
    objects,
    client,
    api: contractClient(app),
    workspaceId: workspace.workspace.id,
    setActor: (value: CloudActor) => {
      currentActor = value
    }
  }
}

/** What accepting an invitation leaves: the grant the API then changes. */
async function invitationGrant(
  context: Awaited<ReturnType<typeof testApp>>,
  documentId: string,
  userId: string
) {
  await context.runtime.database
    .insertInto('documentGrant')
    .values({ id: crypto.randomUUID(), documentId, userId, permission: 'view', createdBy: 'alice' })
    .execute()
}

describe('Cloud document routes', () => {
  test('creates and lists document metadata', async () => {
    const context = await testApp()
    try {
      const created = await context.api.documents.create({
        params: { workspaceId: context.workspaceId },
        body: { name: 'Homepage' }
      })
      expect(created.document.version).toBe(0)

      expect(
        await context.api.documents.list({ params: { workspaceId: context.workspaceId } })
      ).toMatchObject({
        documents: [
          { id: created.document.id, name: 'Homepage', kind: 'design', currentRevisionId: null }
        ]
      })

      const board = await context.api.documents.create({
        params: { workspaceId: context.workspaceId },
        body: { name: 'Retro', kind: 'board' }
      })
      expect(board).toMatchObject({ document: { name: 'Retro', kind: 'board' } })
    } finally {
      await context.runtime.close()
    }
  })

  test.each([false, true])(
    'commits immutable revisions with direct grant: %s',
    async (directGrant) => {
      const context = await testApp()
      try {
        const document = await context.api.documents.create({
          params: { workspaceId: context.workspaceId },
          body: { name: 'Homepage' }
        })
        if (directGrant) {
          await invitationGrant(context, document.document.id, 'bob')
          const grant = await context.client.api.documents[':documentId'].grants[':userId'].$put({
            param: { documentId: document.document.id, userId: 'bob' },
            json: { permission: 'edit' }
          })
          expect(grant.status).toBe(200)
          context.setActor({ userId: 'bob', email: 'bob@example.com', name: 'Bob' })
          expect(
            await outcome(
              context.api.documents.list({ params: { workspaceId: context.workspaceId } })
            )
          ).toMatchObject({ status: 404 })
        }
        const upload = await context.api.documents.createUpload({
          params: { documentId: document.document.id },
          body: {
            baseRevisionId: null,
            byteSize: 128,
            checksum,
            contentType: 'application/octet-stream'
          }
        })
        const uploadRow = await context.runtime.database
          .selectFrom('upload')
          .select('objectKey')
          .where('id', '=', upload.id)
          .executeTakeFirstOrThrow()
        context.objects.put(uploadRow.objectKey, {
          byteSize: 128,
          checksum,
          checksumVerification: 'native',
          contentType: 'application/octet-stream'
        })

        const committed = await context.api.documents.commitUpload({
          params: { uploadId: upload.id },
          body: { checksum, name: 'Updated homepage', kind: 'board' }
        })
        expect(committed.document.currentRevisionId).toBeString()
        expect(committed.document.version).toBe(1)
        expect(committed.document.name).toBe('Updated homepage')
        expect(committed.document.kind).toBe('board')

        expect(
          await context.api.documents.commitUpload({
            params: { uploadId: upload.id },
            body: { checksum, name: 'Stale retry' }
          })
        ).toMatchObject({
          document: {
            name: 'Updated homepage',
            currentRevisionId: committed.document.currentRevisionId,
            version: 1
          }
        })

        context.setActor(actor)
        expect(
          await context.api.documents.usage({ params: { workspaceId: context.workspaceId } })
        ).toEqual({
          usage: { bytesUsed: 128, objectCount: 1, documentCount: 1 }
        })

        expect(
          await context.api.documents.download({ params: { documentId: document.document.id } })
        ).toMatchObject({
          document: {
            document: { id: document.document.id, version: 1, name: 'Updated homepage' },
            revisionId: committed.document.currentRevisionId,
            byteSize: 128,
            checksum,
            download: { method: 'GET' }
          }
        })

        const revision = await context.runtime.database
          .selectFrom('documentRevision')
          .select(['parentRevisionId'])
          .executeTakeFirstOrThrow()
        expect(revision.parentRevisionId).toBeNull()
      } finally {
        await context.runtime.close()
      }
    }
  )

  test('abandons and deletes expired pending uploads', async () => {
    const context = await testApp()
    try {
      const document = await context.api.documents.create({
        params: { workspaceId: context.workspaceId },
        body: { name: 'Homepage' }
      })
      const upload = await context.api.documents.createUpload({
        params: { documentId: document.document.id },
        body: {
          baseRevisionId: null,
          byteSize: 128,
          checksum,
          contentType: 'application/octet-stream'
        }
      })
      const row = await context.runtime.database
        .selectFrom('upload')
        .select('objectKey')
        .where('id', '=', upload.id)
        .executeTakeFirstOrThrow()
      const service = createDocumentService(context.runtime.database, context.objects.store)
      expect(await service.cleanupExpiredUploads(new Date(Date.now() + 16 * 60 * 1000))).toBe(1)
      expect(context.objects.deletedKeys).toEqual([row.objectKey])
      expect(
        await context.runtime.database
          .selectFrom('upload')
          .select('status')
          .where('id', '=', upload.id)
          .executeTakeFirstOrThrow()
      ).toEqual({ status: 'abandoned' })
    } finally {
      await context.runtime.close()
    }
  })

  test('rejects stale base revisions and unverified uploads', async () => {
    const context = await testApp()
    try {
      const document = await context.api.documents.create({
        params: { workspaceId: context.workspaceId },
        body: { name: 'Homepage' }
      })
      expect(
        await outcome(
          context.api.documents.createUpload({
            params: { documentId: document.document.id },
            body: {
              baseRevisionId: crypto.randomUUID(),
              byteSize: 128,
              checksum,
              contentType: 'application/octet-stream'
            }
          })
        )
      ).toMatchObject({ status: 409 })

      const upload = await context.api.documents.createUpload({
        params: { documentId: document.document.id },
        body: {
          baseRevisionId: null,
          byteSize: 128,
          checksum,
          contentType: 'application/octet-stream'
        }
      })
      expect(
        await outcome(
          context.api.documents.commitUpload({
            params: { uploadId: upload.id },
            body: { checksum }
          })
        )
      ).toEqual({ status: 422, code: 'invalid_upload' })
      expect(
        await context.runtime.database
          .selectFrom('upload')
          .select('status')
          .where('id', '=', upload.id)
          .executeTakeFirstOrThrow()
      ).toEqual({ status: 'pending' })
    } finally {
      await context.runtime.close()
    }
  })
})

describe('documents shared with a person', () => {
  const bob: CloudActor = { userId: 'bob', email: 'bob@example.com', name: 'Bob' }
  const SharedDocuments = v.object({
    documents: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        kind: v.string(),
        workspaceName: v.string(),
        permission: v.string(),
        sharedBy: v.nullable(v.object({ name: v.string() }))
      })
    )
  })

  test('lists direct grants outside the person’s workspaces, with their kind, until they are revoked', async () => {
    const aliceAccount = crypto.randomUUID()
    const context = await testApp({ ...actor, userId: aliceAccount })
    try {
      const now = new Date()
      await context.runtime.database
        .insertInto('user')
        .values({
          id: aliceAccount,
          name: 'Alice',
          email: 'alice@example.com',
          emailVerified: true,
          image: null,
          banExpires: null,
          createdAt: now,
          updatedAt: now
        })
        .execute()
      const created = await context.api.documents.create({
        params: { workspaceId: context.workspaceId },
        body: { name: 'Brief', kind: 'board' }
      })
      const documentId = created.document.id
      await invitationGrant(context, documentId, 'bob')
      const grant = await context.client.api.documents[':documentId'].grants[':userId'].$put({
        param: { documentId: documentId, userId: 'bob' },
        json: { permission: 'view' }
      })
      expect(grant.status).toBe(200)

      context.setActor(bob)
      const shared = v.parse(SharedDocuments, await context.api.documents.listShared())
      expect(shared.documents).toEqual([
        {
          id: documentId,
          name: 'Brief',
          kind: 'board',
          workspaceName: 'Documents',
          permission: 'view',
          sharedBy: { name: 'Alice' }
        }
      ])

      await context.runtime.database
        .insertInto('workspaceMember')
        .values({ workspaceId: context.workspaceId, userId: 'bob', role: 'viewer' })
        .execute()
      const asMember = await context.api.documents.listShared()
      expect(asMember.documents).toEqual([])

      await context.runtime.database
        .deleteFrom('workspaceMember')
        .where('userId', '=', 'bob')
        .execute()
      context.setActor({ ...actor, userId: aliceAccount })
      const revoke = await context.client.api.documents[':documentId'].grants[':userId'].$delete({
        param: { documentId, userId: 'bob' }
      })
      expect(revoke.status).toBeLessThan(300)
      context.setActor(bob)
      const afterRevoke = await context.api.documents.listShared()
      expect(afterRevoke.documents).toEqual([])
    } finally {
      await context.runtime.close()
    }
  })
})
