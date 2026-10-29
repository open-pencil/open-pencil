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
  const workspaceId = crypto.randomUUID()
  await runtime.database
    .insertInto('workspace')
    .values({ id: workspaceId, name: 'W', slug: `w-${workspaceId}`, createdBy: 'owner' })
    .execute()
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: unusedAuthAdapter(config),
    objects: createMemoryObjectStore().store,
    resolveSession: async () => null
  })
  const put = (id: string, body: unknown, token = SERVICE_TOKEN) =>
    app.request(`/api/internal/workspaces/${id}/entitlements`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    })
  const enabled = () =>
    new DatabaseEntitlementSource(runtime.database).boolean(
      { type: 'workspace', id: workspaceId },
      CLOUD_FEATURE_KEYS.cloudAI
    )
  return { runtime, workspaceId, put, enabled }
}

const appliedSchema = v.object({ applied: v.boolean() })

describe('internal entitlements API', () => {
  test('keeps the newest decision when billing events arrive out of order', async () => {
    const context = await testApp()
    try {
      const plan = (enabled: boolean, externalVersion: number) => ({
        values: { ai: { enabled } },
        source: 'billing',
        externalVersion
      })
      const newer = await context.put(context.workspaceId, plan(true, 20))
      expect(await responseJSON(newer, appliedSchema)).toEqual({ applied: true })

      const late = await context.put(context.workspaceId, plan(false, 10))
      expect(await responseJSON(late, appliedSchema)).toEqual({ applied: false })
      const redelivered = await context.put(context.workspaceId, plan(true, 20))
      expect(await responseJSON(redelivered, appliedSchema)).toEqual({ applied: false })
      expect(await context.enabled()).toBe(true)

      const canceled = await context.put(context.workspaceId, plan(false, 30))
      expect(await responseJSON(canceled, appliedSchema)).toEqual({ applied: true })
      expect(await context.enabled()).toBe(false)
    } finally {
      await context.runtime.close()
    }
  })

  test('refuses callers without the service token', async () => {
    const context = await testApp()
    try {
      const body = { values: { ai: { enabled: true } }, source: 'billing', externalVersion: 1 }
      expect((await context.put(context.workspaceId, body, 'x'.repeat(48))).status).toBe(401)
      expect(await context.enabled()).toBeNull()
    } finally {
      await context.runtime.close()
    }
  })

  test('answers not found for unknown workspaces and invalid bodies with 400', async () => {
    const context = await testApp()
    try {
      const body = { values: {}, source: 'billing', externalVersion: 1 }
      expect((await context.put(crypto.randomUUID(), body)).status).toBe(404)
      expect((await context.put('not-a-uuid', body)).status).toBe(404)
      expect(
        (await context.put(context.workspaceId, { ...body, externalVersion: -1 })).status
      ).toBe(400)
    } finally {
      await context.runtime.close()
    }
  })
})
