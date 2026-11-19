import { describe, expect, test } from 'bun:test'

import { unusedAuthAdapter } from '#cloud-tests/helpers/auth'
import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  CLOUD_FEATURE_KEYS,
  createCloudApp,
  DatabaseEntitlementSource,
  parseCloudServerConfig
} from '#cloud/server'
import { testClient } from 'hono/testing'
import * as v from 'valibot'

const SERVICE_TOKEN = 'billing-service-token-with-at-least-32-characters'

const config = parseCloudServerConfig({
  deployment: 'self-hosted',
  publicURL: 'http://localhost:8787',
  databaseURL: 'postgresql://test:test@localhost/test',
  authSecret: 'integration-test-secret-at-least-32-characters',
  s3Endpoint: 'http://localhost:9000',
  s3Region: 'us-east-1',
  s3Bucket: 'openpencil',
  s3AccessKeyId: 'openpencil',
  s3SecretAccessKey: 'openpencil-secret',
  internalServiceToken: SERVICE_TOKEN
})

async function testApp() {
  const runtime = await createCloudTestDatabase()
  const userId = crypto.randomUUID()
  await runtime.database
    .insertInto('user')
    .values({ id: userId, name: 'Owner', email: 'owner@example.com', emailVerified: true })
    .execute()
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: unusedAuthAdapter(config),
    objects: createMemoryObjectStore().store,
    resolveSession: async () => null
  })
  const entitlements = testClient(app).api.internal.accounts[':userId'].entitlements
  const put = (
    userId: string,
    json: Parameters<typeof entitlements.$put>[0]['json'],
    token = SERVICE_TOKEN
  ) =>
    entitlements.$put(
      { param: { userId }, json },
      { headers: { Authorization: `Bearer ${token}` } }
    )
  const enabled = () =>
    new DatabaseEntitlementSource(runtime.database).boolean(
      { type: 'user', id: userId },
      CLOUD_FEATURE_KEYS.cloudServices
    )
  return { runtime, app, userId, put, enabled }
}

const appliedSchema = v.object({ applied: v.boolean() })

describe('internal entitlements API', () => {
  test('keeps the newest decision when billing events arrive out of order', async () => {
    const context = await testApp()
    try {
      const plan = (enabled: boolean, externalVersion: number) => ({
        values: { services: { enabled } },
        source: 'billing',
        externalVersion
      })
      const newer = await context.put(context.userId, plan(true, 20))
      expect(await responseJSON(newer, appliedSchema)).toEqual({ applied: true })

      const late = await context.put(context.userId, plan(false, 10))
      expect(await responseJSON(late, appliedSchema)).toEqual({ applied: false })
      const redelivered = await context.put(context.userId, plan(true, 20))
      expect(await responseJSON(redelivered, appliedSchema)).toEqual({ applied: false })
      expect(await context.enabled()).toBe(true)

      const canceled = await context.put(context.userId, plan(false, 30))
      expect(await responseJSON(canceled, appliedSchema)).toEqual({ applied: true })
      expect(await context.enabled()).toBe(false)
    } finally {
      await context.runtime.close()
    }
  })

  test('refuses callers without the service token', async () => {
    const context = await testApp()
    try {
      const body = {
        values: { services: { enabled: true } },
        source: 'billing',
        externalVersion: 1
      }
      expect((await context.put(context.userId, body, 'x'.repeat(48))).status).toBe(401)
      expect(await context.enabled()).toBeNull()
    } finally {
      await context.runtime.close()
    }
  })

  test('answers not found for unknown accounts and invalid bodies with 400', async () => {
    const context = await testApp()
    try {
      const body = { values: {}, source: 'billing', externalVersion: 1 }
      expect((await context.put(crypto.randomUUID(), body)).status).toBe(404)
      expect((await context.put('not-a-uuid', body)).status).toBe(404)
      expect((await context.put(context.userId, { ...body, externalVersion: -1 })).status).toBe(400)
    } finally {
      await context.runtime.close()
    }
  })

  test('counts the people who can edit across the workspaces an account owns, once each', async () => {
    const context = await testApp()
    try {
      const { database } = context.runtime
      const person = async (name: string) => {
        const id = crypto.randomUUID()
        await database
          .insertInto('user')
          .values({ id, name, email: `${name}@example.com`, emailVerified: true })
          .execute()
        return id
      }
      const [editor, viewer, elsewhere] = await Promise.all([
        person('editor'),
        person('viewer'),
        person('elsewhere')
      ])
      const workspace = async (
        ownerId: string,
        members: [string, 'admin' | 'editor' | 'viewer'][]
      ) => {
        const id = crypto.randomUUID()
        await database
          .insertInto('workspace')
          .values({ id, name: id, slug: id, createdBy: ownerId, ownerId })
          .execute()
        await database
          .insertInto('workspaceMember')
          .values(members.map(([userId, role]) => ({ workspaceId: id, userId, role })))
          .execute()
      }
      // The editor edits in both of the owner's workspaces and takes one seat; the viewer none.
      await workspace(context.userId, [
        [context.userId, 'admin'],
        [editor, 'editor'],
        [viewer, 'viewer']
      ])
      await workspace(context.userId, [
        [context.userId, 'admin'],
        [editor, 'admin']
      ])
      // Someone else's workspace counts toward theirs.
      await workspace(elsewhere, [
        [elsewhere, 'admin'],
        [context.userId, 'editor']
      ])

      const seats = testClient(context.app).api.internal.accounts[':userId'].seats
      const response = await seats.$get(
        { param: { userId: context.userId } },
        { headers: { Authorization: `Bearer ${SERVICE_TOKEN}` } }
      )
      expect(await responseJSON(response, v.object({ seats: v.number() }))).toEqual({ seats: 2 })
      const unknown = await seats.$get(
        { param: { userId: crypto.randomUUID() } },
        { headers: { Authorization: `Bearer ${SERVICE_TOKEN}` } }
      )
      expect(unknown.status).toBe(404)
    } finally {
      await context.runtime.close()
    }
  })
})
