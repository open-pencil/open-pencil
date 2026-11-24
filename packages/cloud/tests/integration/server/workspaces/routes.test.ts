import { describe, expect, test } from 'bun:test'

import { contractClient, outcome } from '#cloud-tests/helpers/contract'
import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import {
  CLOUD_RATE_LIMITS,
  createCloudApp,
  createBetterAuthAdapter,
  parseCloudServerConfig,
  type CloudActor
} from '#cloud/server'
import { testClient } from 'hono/testing'

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

      const listed = await contractClient(app).workspaces.list()
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
      expect(await outcome(contractClient(app).workspaces.list())).toEqual({
        status: 401,
        code: 'unauthorized'
      })
    } finally {
      await runtime.close()
    }
  })

  test('returns the resolved session actor', async () => {
    const { app, runtime } = await testApp(alice)
    try {
      expect(await contractClient(app).session.session()).toEqual({ user: alice })
    } finally {
      await runtime.close()
    }
  })

  test('creates, lists, and reads an owned workspace', async () => {
    const { app, runtime } = await testApp(alice)
    try {
      const api = contractClient(app)
      const created = await api.workspaces.create({
        body: { name: 'Design team', slug: 'design-team' }
      })
      expect(created.workspace).toMatchObject({
        name: 'Design team',
        slug: 'design-team',
        role: 'admin'
      })

      expect(await api.workspaces.list()).toMatchObject({
        workspaces: [{ id: created.workspace.id, role: 'admin', owner: true }]
      })

      expect(
        await api.workspaces.get({ params: { workspaceId: created.workspace.id } })
      ).toMatchObject({ workspace: created.workspace })
    } finally {
      await runtime.close()
    }
  })

  test('does not reveal another user workspace', async () => {
    const { app, runtime } = await testApp(alice)
    try {
      const created = await contractClient(app).workspaces.create({
        body: { name: 'Private', slug: 'private-space' }
      })
      const bobApp = createCloudApp({
        config,
        database: runtime.database,
        auth: createBetterAuthAdapter(config, runtime.database),
        objects: createMemoryObjectStore().store,
        resolveSession: async () => bob
      })

      expect(
        await outcome(
          contractClient(bobApp).workspaces.get({ params: { workspaceId: created.workspace.id } })
        )
      ).toEqual({ status: 404, code: 'not_found' })
    } finally {
      await runtime.close()
    }
  })

  test("answers 404, and reports nothing, for another account's workspace entitlements", async () => {
    const { app, runtime } = await testApp(alice)
    try {
      const created = await contractClient(app).workspaces.create({
        body: { name: 'Private', slug: 'private-plan' }
      })
      const reported: unknown[] = []
      const bobApp = createCloudApp({
        config,
        database: runtime.database,
        auth: createBetterAuthAdapter(config, runtime.database),
        objects: createMemoryObjectStore().store,
        resolveSession: async () => bob,
        reportError: async (error) => {
          reported.push(error)
        }
      })

      expect(
        await outcome(
          contractClient(bobApp).workspaces.entitlements({
            params: { workspaceId: created.workspace.id }
          })
        )
      ).toEqual({ status: 404, code: 'not_found' })
      expect(reported).toEqual([])
    } finally {
      await runtime.close()
    }
  })

  test('validates workspace input and reports duplicate slugs', async () => {
    const { app, runtime } = await testApp(alice)
    try {
      const api = contractClient(app)
      expect(await outcome(api.workspaces.create({ body: { name: '' } }))).toMatchObject({
        status: 400
      })

      const body = { name: 'Team', slug: 'shared-team' }
      expect(await outcome(api.workspaces.create({ body }))).toBe('ok')
      expect(await outcome(api.workspaces.create({ body }))).toEqual({
        status: 409,
        code: 'slug_conflict'
      })
    } finally {
      await runtime.close()
    }
  })

  test("counts a workspace's invitations and resends on one budget, and caps the actor across workspaces", async () => {
    const { app, runtime } = await testApp(alice)
    try {
      const api = contractClient(app)
      const createWorkspace = async (slug: string) =>
        (await api.workspaces.create({ body: { name: slug, slug } })).workspace.id
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
      const resend = async (workspaceId: string) => {
        const resent = await outcome(
          api.workspaces.resendInvitation({
            params: { workspaceId, invitationId: crypto.randomUUID() }
          })
        )
        return resent === 'ok' ? 200 : resent.status
      }

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
