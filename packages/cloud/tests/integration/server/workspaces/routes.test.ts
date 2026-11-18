import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  CLOUD_RATE_LIMITS,
  createCloudApp,
  createBetterAuthAdapter,
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
  const auth = createBetterAuthAdapter(config, runtime.database)
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
  test('gives an active account one workspace of its own, however often it asks', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const app = createCloudApp({
        config,
        database: runtime.database,
        auth: createBetterAuthAdapter(config, runtime.database),
        objects: createMemoryObjectStore().store,
        resolveIdentity: async () => alice,
        resolveSession: async () => alice
      })
      const client = testClient(app)
      const statuses = await Promise.all([
        client.api.account.status.$get(),
        client.api.account.status.$get()
      ])
      expect(statuses.map((response) => response.status)).toEqual([200, 200])
      await client.api.account.status.$get()

      const listed = await responseJSON(
        await client.api.workspaces.$get(),
        v.object({ workspaces: v.array(v.object({ name: v.string(), role: v.string() })) })
      )
      expect(listed.workspaces).toEqual([
        expect.objectContaining({ name: 'Alice’s workspace', role: 'admin' })
      ])
    } finally {
      await runtime.close()
    }
  })

  test('requires authentication for Cloud APIs', async () => {
    const { app, runtime } = await testApp(null)
    try {
      const response = await testClient(app).api.workspaces.$get()
      expect(response.status).toBe(401)
      expect(
        await responseJSON(response, v.object({ error: v.object({ code: v.string() }) }))
      ).toEqual({ error: { code: 'unauthorized' } })
    } finally {
      await runtime.close()
    }
  })

  test('returns the resolved session actor', async () => {
    const { app, runtime } = await testApp(alice)
    try {
      const response = await testClient(app).api.session.$get()
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ user: alice })
    } finally {
      await runtime.close()
    }
  })

  test('creates, lists, and reads an owned workspace', async () => {
    const { app, runtime } = await testApp(alice)
    try {
      const client = testClient(app)
      const createResponse = await client.api.workspaces.$post({
        json: { name: 'Design team', slug: 'design-team' }
      })
      expect(createResponse.status).toBe(201)
      const created = await responseJSON(
        createResponse,
        v.object({
          workspace: v.object({
            id: v.string(),
            name: v.string(),
            slug: v.string(),
            role: v.string()
          })
        })
      )
      expect(created.workspace).toMatchObject({
        name: 'Design team',
        slug: 'design-team',
        role: 'admin'
      })

      const listResponse = await client.api.workspaces.$get()
      expect(listResponse.status).toBe(200)
      expect(await listResponse.json()).toMatchObject({
        workspaces: [{ id: created.workspace.id, role: 'admin' }]
      })

      const getResponse = await client.api.workspaces[':workspaceId'].$get({
        param: { workspaceId: created.workspace.id }
      })
      expect(getResponse.status).toBe(200)
      expect(await getResponse.json()).toMatchObject({ workspace: created.workspace })
    } finally {
      await runtime.close()
    }
  })

  test('does not reveal another user workspace', async () => {
    const { app, runtime } = await testApp(alice)
    try {
      const createResponse = await testClient(app).api.workspaces.$post({
        json: { name: 'Private', slug: 'private-space' }
      })
      const created = await responseJSON(
        createResponse,
        v.object({ workspace: v.object({ id: v.string() }) })
      )
      const bobApp = createCloudApp({
        config,
        database: runtime.database,
        auth: createBetterAuthAdapter(config, runtime.database),
        objects: createMemoryObjectStore().store,
        resolveSession: async () => bob
      })

      const response = await testClient(bobApp).api.workspaces[':workspaceId'].$get({
        param: { workspaceId: created.workspace.id }
      })
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: { code: 'not_found' } })
    } finally {
      await runtime.close()
    }
  })

  test('validates workspace input and reports duplicate slugs', async () => {
    const { app, runtime } = await testApp(alice)
    try {
      const client = testClient(app)
      const invalid = await client.api.workspaces.$post({ json: { name: '' } })
      expect(invalid.status).toBe(400)

      const json = { name: 'Team', slug: 'shared-team' }
      const first = await client.api.workspaces.$post({ json })
      expect(first.status).toBe(201)
      const duplicate = await client.api.workspaces.$post({ json })
      expect(duplicate.status).toBe(409)
      expect(await duplicate.json()).toEqual({ error: { code: 'slug_conflict' } })
    } finally {
      await runtime.close()
    }
  })

  test("counts a workspace's invitations and resends on one budget, and caps the actor across workspaces", async () => {
    const { app, runtime } = await testApp(alice)
    try {
      const client = testClient(app)
      const createWorkspace = async (slug: string) => {
        const created = await responseJSON(
          await client.api.workspaces.$post({ json: { name: slug, slug } }),
          v.object({ workspace: v.object({ id: v.string() }) })
        )
        return created.workspace.id
      }
      const first = await createWorkspace('first-team')
      const second = await createWorkspace('second-team')
      const third = await createWorkspace('third-team')
      // Bodies the routes refuse still count: the budget is spent before the route answers.
      const invite = async (workspaceId: string) =>
        (
          await app.request(`/api/workspaces/${workspaceId}/invitations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
          })
        ).status
      const resend = async (workspaceId: string) =>
        (
          await client.api.workspaces[':workspaceId'].invitations[':invitationId'].resend.$post({
            param: { workspaceId, invitationId: crypto.randomUUID() }
          })
        ).status

      const { limit } = CLOUD_RATE_LIMITS.invitationMutation
      for (let sent = 0; sent < limit; sent++) {
        // A resend names a new invitation each time, as a chain of resends does.
        const status = sent % 2 === 0 ? await invite(first) : await resend(first)
        expect(status).not.toBe(429)
      }
      expect(await resend(first)).toBe(429)
      expect(await invite(first)).toBe(429)
      expect(await invite(second)).not.toBe(429)

      // Spread over workspaces, each under its own budget, requests still meet the actor's.
      const { actorLimit } = CLOUD_RATE_LIMITS.invitationMutation
      for (let sent = limit + 1; sent < actorLimit; sent++) {
        expect(await invite(second)).not.toBe(429)
      }
      expect(await invite(third)).toBe(429)
    } finally {
      await runtime.close()
    }
  })
})
