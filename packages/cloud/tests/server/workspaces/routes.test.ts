import { describe, expect, test } from 'bun:test'

import {
  createCloudApp,
  createCloudAuth,
  parseCloudServerConfig,
  type CloudActor
} from '@open-pencil/cloud/server'

import { createCloudTestDatabase } from '../../helpers/database'
import { createMemoryObjectStore } from '../../helpers/objects'

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

const alice: CloudActor = {
  userId: 'alice',
  email: 'alice@example.com',
  name: 'Alice'
}
const bob: CloudActor = {
  userId: 'bob',
  email: 'bob@example.com',
  name: 'Bob'
}

async function testApp(actor: CloudActor | null) {
  const runtime = await createCloudTestDatabase()
  const auth = createCloudAuth(config, runtime.database)
  const objects = createMemoryObjectStore()
  return {
    runtime,
    app: createCloudApp({
      config,
      database: runtime.database,
      auth,
      objects: objects.store,
      resolveSession: async () => actor
    })
  }
}

describe('Cloud workspace routes', () => {
  test('requires authentication for Cloud APIs', async () => {
    const { app, runtime } = await testApp(null)
    try {
      const response = await app.request('/api/workspaces')
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: { code: 'unauthorized' } })
    } finally {
      await runtime.close()
    }
  })

  test('returns the resolved session actor', async () => {
    const { app, runtime } = await testApp(alice)
    try {
      const response = await app.request('/api/session')
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ user: alice })
    } finally {
      await runtime.close()
    }
  })

  test('creates, lists, and reads an owned workspace', async () => {
    const { app, runtime } = await testApp(alice)
    try {
      const createResponse = await app.request('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Design team', slug: 'design-team' })
      })
      expect(createResponse.status).toBe(201)
      const created = (await createResponse.json()) as {
        workspace: { id: string; name: string; slug: string; role: string }
      }
      expect(created.workspace).toMatchObject({
        name: 'Design team',
        slug: 'design-team',
        role: 'admin'
      })

      const listResponse = await app.request('/api/workspaces')
      expect(listResponse.status).toBe(200)
      expect(await listResponse.json()).toMatchObject({
        workspaces: [{ id: created.workspace.id, role: 'admin' }]
      })

      const getResponse = await app.request(`/api/workspaces/${created.workspace.id}`)
      expect(getResponse.status).toBe(200)
      expect(await getResponse.json()).toMatchObject({ workspace: created.workspace })
    } finally {
      await runtime.close()
    }
  })

  test('does not reveal another user workspace', async () => {
    const { app, runtime } = await testApp(alice)
    try {
      const createResponse = await app.request('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Private', slug: 'private-space' })
      })
      const created = (await createResponse.json()) as { workspace: { id: string } }
      const bobApp = createCloudApp({
        config,
        database: runtime.database,
        auth: createCloudAuth(config, runtime.database),
        objects: createMemoryObjectStore().store,
        resolveSession: async () => bob
      })

      const response = await bobApp.request(`/api/workspaces/${created.workspace.id}`)
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: { code: 'not_found' } })
    } finally {
      await runtime.close()
    }
  })

  test('validates workspace input and reports duplicate slugs', async () => {
    const { app, runtime } = await testApp(alice)
    try {
      const invalid = await app.request('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' })
      })
      expect(invalid.status).toBe(400)

      const body = JSON.stringify({ name: 'Team', slug: 'shared-team' })
      const first = await app.request('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      })
      expect(first.status).toBe(201)
      const duplicate = await app.request('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      })
      expect(duplicate.status).toBe(409)
      expect(await duplicate.json()).toEqual({ error: { code: 'slug_conflict' } })
    } finally {
      await runtime.close()
    }
  })
})
