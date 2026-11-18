import { describe, expect, test } from 'bun:test'

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
      const create = await context.client.api.workspaces[':workspaceId'].documents.$post({
        param: { workspaceId: context.workspaceId },
        json: { name: 'Homepage' }
      })
      expect(create.status).toBe(201)
      const created = await responseJSON(
        create,
        v.object({ document: v.object({ id: v.string(), version: v.number() }) })
      )
      expect(created.document.version).toBe(0)

      const list = await context.client.api.workspaces[':workspaceId'].documents.$get({
        param: { workspaceId: context.workspaceId }
      })
      expect(list.status).toBe(200)
      expect(await list.json()).toMatchObject({
        documents: [
          { id: created.document.id, name: 'Homepage', kind: 'design', currentRevisionId: null }
        ]
      })

      const board = await context.client.api.workspaces[':workspaceId'].documents.$post({
        param: { workspaceId: context.workspaceId },
        json: { name: 'Retro', kind: 'board' }
      })
      expect(await board.json()).toMatchObject({ document: { name: 'Retro', kind: 'board' } })
    } finally {
      await context.runtime.close()
    }
  })

  test.each([false, true])(
    'commits immutable revisions with direct grant: %s',
    async (directGrant) => {
      const context = await testApp()
      try {
        const create = await context.client.api.workspaces[':workspaceId'].documents.$post({
          param: { workspaceId: context.workspaceId },
          json: { name: 'Homepage' }
        })
        const document = await responseJSON(
          create,
          v.object({ document: v.object({ id: v.string() }) })
        )
        if (directGrant) {
          await invitationGrant(context, document.document.id, 'bob')
          const grant = await context.client.api.documents[':documentId'].grants[':userId'].$put({
            param: { documentId: document.document.id, userId: 'bob' },
            json: { permission: 'edit' }
          })
          expect(grant.status).toBe(200)
          context.setActor({ userId: 'bob', email: 'bob@example.com', name: 'Bob' })
          const listing = await context.client.api.workspaces[':workspaceId'].documents.$get({
            param: { workspaceId: context.workspaceId }
          })
          expect(listing.status).toBe(404)
        }
        const uploadResponse = await context.client.api.documents[':documentId'].uploads.$post({
          param: { documentId: document.document.id },
          json: {
            baseRevisionId: null,
            byteSize: 128,
            checksum,
            contentType: 'application/octet-stream'
          }
        })
        expect(uploadResponse.status).toBe(201)

        const upload = await responseJSON(
          uploadResponse,
          v.object({
            id: v.string(),
            upload: v.object({
              kind: v.string(),
              url: v.string(),
              headers: v.record(v.string(), v.string())
            })
          })
        )
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

        const commit = await context.client.api.uploads[':uploadId'].commit.$post({
          param: { uploadId: upload.id },
          json: { checksum, name: 'Updated homepage', kind: 'board' }
        })
        expect(commit.status).toBe(200)
        const committed = await responseJSON(
          commit,
          v.object({
            document: v.object({
              currentRevisionId: v.string(),
              version: v.number(),
              name: v.string(),
              kind: v.string()
            })
          })
        )
        expect(committed.document.currentRevisionId).toBeString()
        expect(committed.document.version).toBe(1)
        expect(committed.document.name).toBe('Updated homepage')
        expect(committed.document.kind).toBe('board')

        const repeatedCommit = await context.client.api.uploads[':uploadId'].commit.$post({
          param: { uploadId: upload.id },
          json: { checksum, name: 'Stale retry' }
        })
        expect(repeatedCommit.status).toBe(200)
        expect(await repeatedCommit.json()).toMatchObject({
          document: {
            name: 'Updated homepage',
            currentRevisionId: committed.document.currentRevisionId,
            version: 1
          }
        })

        context.setActor(actor)
        const usageResponse = await context.client.api.workspaces[':workspaceId'].usage.$get({
          param: { workspaceId: context.workspaceId }
        })
        expect(usageResponse.status).toBe(200)
        expect(await usageResponse.json()).toEqual({
          usage: { bytesUsed: 128, objectCount: 1, documentCount: 1 }
        })

        const downloadResponse = await context.client.api.documents[':documentId'].$get({
          param: { documentId: document.document.id }
        })
        expect(downloadResponse.status).toBe(200)
        expect(await downloadResponse.json()).toMatchObject({
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
      const create = await context.client.api.workspaces[':workspaceId'].documents.$post({
        param: { workspaceId: context.workspaceId },
        json: { name: 'Homepage' }
      })
      const document = await responseJSON(
        create,
        v.object({ document: v.object({ id: v.string() }) })
      )
      const uploadResponse = await context.client.api.documents[':documentId'].uploads.$post({
        param: { documentId: document.document.id },
        json: {
          baseRevisionId: null,
          byteSize: 128,
          checksum,
          contentType: 'application/octet-stream'
        }
      })
      const upload = await responseJSON(uploadResponse, v.object({ id: v.string() }))
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
      const create = await context.client.api.workspaces[':workspaceId'].documents.$post({
        param: { workspaceId: context.workspaceId },
        json: { name: 'Homepage' }
      })
      const document = await responseJSON(
        create,
        v.object({ document: v.object({ id: v.string() }) })
      )
      const stale = await context.client.api.documents[':documentId'].uploads.$post({
        param: { documentId: document.document.id },
        json: {
          baseRevisionId: crypto.randomUUID(),
          byteSize: 128,
          checksum,
          contentType: 'application/octet-stream'
        }
      })
      expect(stale.status).toBe(409)

      const pending = await context.client.api.documents[':documentId'].uploads.$post({
        param: { documentId: document.document.id },
        json: {
          baseRevisionId: null,
          byteSize: 128,
          checksum,
          contentType: 'application/octet-stream'
        }
      })
      const upload = await responseJSON(pending, v.object({ id: v.string() }))
      const commit = await context.client.api.uploads[':uploadId'].commit.$post({
        param: { uploadId: upload.id },
        json: { checksum }
      })
      expect(commit.status).toBe(422)
      expect(await commit.json()).toEqual({ error: { code: 'invalid_upload' } })
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
      const create = await context.client.api.workspaces[':workspaceId'].documents.$post({
        param: { workspaceId: context.workspaceId },
        json: { name: 'Brief', kind: 'board' }
      })
      const created = await responseJSON(
        create,
        v.object({ document: v.object({ id: v.string() }) })
      )
      const documentId = created.document.id
      await invitationGrant(context, documentId, 'bob')
      const grant = await context.client.api.documents[':documentId'].grants[':userId'].$put({
        param: { documentId: documentId, userId: 'bob' },
        json: { permission: 'view' }
      })
      expect(grant.status).toBe(200)

      context.setActor(bob)
      const shared = await responseJSON(
        await context.client.api['shared-documents'].$get(),
        SharedDocuments
      )
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
      const asMember = await responseJSON(
        await context.client.api['shared-documents'].$get(),
        SharedDocuments
      )
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
      const afterRevoke = await responseJSON(
        await context.client.api['shared-documents'].$get(),
        SharedDocuments
      )
      expect(afterRevoke.documents).toEqual([])
    } finally {
      await context.runtime.close()
    }
  })
})
