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

async function testApp() {
  let currentActor = actor
  const runtime = await createCloudTestDatabase()
  const objects = createMemoryObjectStore()
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: createBetterAuthAdapter(config, runtime.database),
    objects: objects.store,
    resolveSession: async () => currentActor
  })
  const workspaceResponse = await app.request('/api/workspaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Documents', slug: 'documents-team' })
  })
  const workspace = await responseJSON(
    workspaceResponse,
    v.object({ workspace: v.object({ id: v.string() }) })
  )
  return {
    runtime,
    objects,
    app,
    workspaceId: workspace.workspace.id,
    setActor: (value: CloudActor) => {
      currentActor = value
    }
  }
}

describe('Cloud document routes', () => {
  test('creates and lists document metadata', async () => {
    const context = await testApp()
    try {
      const create = await context.app.request(`/api/workspaces/${context.workspaceId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Homepage' })
      })
      expect(create.status).toBe(201)
      const created = await responseJSON(
        create,
        v.object({ document: v.object({ id: v.string(), version: v.number() }) })
      )
      expect(created.document.version).toBe(0)

      const list = await context.app.request(`/api/workspaces/${context.workspaceId}/documents`)
      expect(list.status).toBe(200)
      expect(await list.json()).toMatchObject({
        documents: [{ id: created.document.id, name: 'Homepage', currentRevisionId: null }]
      })
    } finally {
      await context.runtime.close()
    }
  })

  test.each([false, true])(
    'commits immutable revisions with direct grant: %s',
    async (directGrant) => {
      const context = await testApp()
      try {
        const create = await context.app.request(
          `/api/workspaces/${context.workspaceId}/documents`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Homepage' })
          }
        )
        const document = await responseJSON(
          create,
          v.object({ document: v.object({ id: v.string() }) })
        )
        if (directGrant) {
          const grant = await context.app.request(
            `/api/documents/${document.document.id}/grants/bob`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ permission: 'edit' })
            }
          )
          expect(grant.status).toBe(200)
          context.setActor({ userId: 'bob', email: 'bob@example.com', name: 'Bob' })
          const listing = await context.app.request(
            `/api/workspaces/${context.workspaceId}/documents`
          )
          expect(listing.status).toBe(404)
        }
        const uploadResponse = await context.app.request(
          `/api/documents/${document.document.id}/uploads`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              baseRevisionId: null,
              byteSize: 128,
              checksum,
              contentType: 'application/octet-stream'
            })
          }
        )
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

        const commit = await context.app.request(`/api/uploads/${upload.id}/commit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checksum })
        })
        expect(commit.status).toBe(200)
        const committed = await responseJSON(
          commit,
          v.object({ document: v.object({ currentRevisionId: v.string(), version: v.number() }) })
        )
        expect(committed.document.currentRevisionId).toBeString()
        expect(committed.document.version).toBe(1)

        const repeatedCommit = await context.app.request(`/api/uploads/${upload.id}/commit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checksum })
        })
        expect(repeatedCommit.status).toBe(200)
        expect(await repeatedCommit.json()).toMatchObject({
          document: {
            currentRevisionId: committed.document.currentRevisionId,
            version: 1
          }
        })

        context.setActor(actor)
        const usageResponse = await context.app.request(
          `/api/workspaces/${context.workspaceId}/usage`
        )
        expect(usageResponse.status).toBe(200)
        expect(await usageResponse.json()).toEqual({
          usage: { bytesUsed: 128, objectCount: 1, documentCount: 1 }
        })

        const downloadResponse = await context.app.request(`/api/documents/${document.document.id}`)
        expect(downloadResponse.status).toBe(200)
        expect(await downloadResponse.json()).toMatchObject({
          document: {
            document: { id: document.document.id, version: 1 },
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
      const create = await context.app.request(`/api/workspaces/${context.workspaceId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Homepage' })
      })
      const document = await responseJSON(
        create,
        v.object({ document: v.object({ id: v.string() }) })
      )
      const uploadResponse = await context.app.request(
        `/api/documents/${document.document.id}/uploads`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseRevisionId: null,
            byteSize: 128,
            checksum,
            contentType: 'application/octet-stream'
          })
        }
      )
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
      const create = await context.app.request(`/api/workspaces/${context.workspaceId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Homepage' })
      })
      const document = await responseJSON(
        create,
        v.object({ document: v.object({ id: v.string() }) })
      )
      const stale = await context.app.request(`/api/documents/${document.document.id}/uploads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseRevisionId: crypto.randomUUID(),
          byteSize: 128,
          checksum,
          contentType: 'application/octet-stream'
        })
      })
      expect(stale.status).toBe(409)

      const pending = await context.app.request(`/api/documents/${document.document.id}/uploads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseRevisionId: null,
          byteSize: 128,
          checksum,
          contentType: 'application/octet-stream'
        })
      })
      const upload = await responseJSON(pending, v.object({ id: v.string() }))
      const commit = await context.app.request(`/api/uploads/${upload.id}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checksum })
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
