import { describe, expect, test } from 'bun:test'

import {
  createCloudApp,
  createCloudAuth,
  parseCloudServerConfig,
  type CloudActor
} from '../src/server'
import { createCloudTestDatabase } from './database'
import { createMemoryObjectStore } from './objects'

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
  const runtime = await createCloudTestDatabase()
  const objects = createMemoryObjectStore()
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: createCloudAuth(config, runtime.database),
    objects: objects.store,
    resolveSession: async () => actor
  })
  const workspaceResponse = await app.request('/api/workspaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Documents', slug: 'documents-team' })
  })
  const workspace = (await workspaceResponse.json()) as { workspace: { id: string } }
  return { runtime, objects, app, workspaceId: workspace.workspace.id }
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
      const created = (await create.json()) as { document: { id: string; version: number } }
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

  test('creates a presigned upload and commits an immutable revision', async () => {
    const context = await testApp()
    try {
      const create = await context.app.request(`/api/workspaces/${context.workspaceId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Homepage' })
      })
      const document = (await create.json()) as { document: { id: string } }
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
      const upload = (await uploadResponse.json()) as {
        id: string
        upload: { url: string; headers: Record<string, string> }
      }
      const uploadRow = await context.runtime.database
        .selectFrom('upload')
        .select('objectKey')
        .where('id', '=', upload.id)
        .executeTakeFirstOrThrow()
      context.objects.put(uploadRow.objectKey, {
        byteSize: 128,
        checksum,
        contentType: 'application/octet-stream'
      })

      const commit = await context.app.request(`/api/uploads/${upload.id}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checksum })
      })
      expect(commit.status).toBe(200)
      const committed = (await commit.json()) as {
        document: { currentRevisionId: string; version: number }
      }
      expect(committed.document.currentRevisionId).toBeString()
      expect(committed.document.version).toBe(1)

      const revision = await context.runtime.database
        .selectFrom('documentRevision')
        .select(['parentRevisionId'])
        .executeTakeFirstOrThrow()
      expect(revision.parentRevisionId).toBeNull()
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
      const document = (await create.json()) as { document: { id: string } }
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
      const upload = (await pending.json()) as { id: string }
      const commit = await context.app.request(`/api/uploads/${upload.id}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checksum })
      })
      expect(commit.status).toBe(422)
      expect(await commit.json()).toEqual({ error: { code: 'invalid_upload' } })
    } finally {
      await context.runtime.close()
    }
  })
})
