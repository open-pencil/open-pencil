import { describe, expect, test } from 'bun:test'

import { unusedAuthAdapter } from '#cloud-tests/helpers/auth'
import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import { createContractClient } from '#cloud/client'
import { internalContract, type setAccountEntitlementsSchema } from '#cloud/contract'
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
  // Services call the internal API over plain HTTP, so the tests send what they would.
  const put = (
    userId: string,
    json: v.InferInput<typeof setAccountEntitlementsSchema>,
    token = SERVICE_TOKEN
  ) =>
    app.request(`/api/internal/accounts/${userId}/entitlements`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(json)
    })
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

  test("answers a service's contract client, which reads refusals as it chooses", async () => {
    const context = await testApp()
    try {
      const client = (token: string) =>
        createContractClient(internalContract, 'http://localhost:8787/api/internal', {
          fetch: async (input, init) => context.app.request(new Request(input, init)),
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'omit',
          refusal: (status, body) => new Error(`HTTP ${status} ${JSON.stringify(body)}`)
        })
      const billing = client(SERVICE_TOKEN)
      const set = (userId: string) =>
        billing.setAccountEntitlements({
          params: { userId },
          body: { values: { services: { enabled: true } }, source: 'billing', externalVersion: 1 }
        })
      expect(await set(context.userId)).toEqual({ applied: true })
      expect(await context.enabled()).toBe(true)
      expect(await billing.accountSeats({ params: { userId: context.userId } })).toEqual({
        seats: 0
      })
      await expect(set(crypto.randomUUID())).rejects.toThrow(
        'HTTP 404 {"error":{"code":"not_found"'
      )
      await expect(
        client('x'.repeat(48)).accountSeats({ params: { userId: context.userId } })
      ).rejects.toThrow('HTTP 401 {"error":{"code":"unauthorized"}}')
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

      const seats = (userId: string) =>
        context.app.request(`/api/internal/accounts/${userId}/seats`, {
          headers: { Authorization: `Bearer ${SERVICE_TOKEN}` }
        })
      const response = await seats(context.userId)
      expect(await responseJSON(response, v.object({ seats: v.number() }))).toEqual({ seats: 2 })
      const unknown = await seats(crypto.randomUUID())
      expect(unknown.status).toBe(404)
    } finally {
      await context.runtime.close()
    }
  })
})

describe('internal usage API', () => {
  const usage = (
    context: Awaited<ReturnType<typeof testApp>>,
    query: string,
    token = SERVICE_TOKEN
  ) =>
    context.app.request(`/api/internal/usage/daily?${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    })

  test('counts each UTC day of the range, quiet days as zeros, and the totals now', async () => {
    const context = await testApp()
    try {
      const { database } = context.runtime
      // The owner from `testApp` signed up today, outside the range.
      const early = crypto.randomUUID()
      const late = crypto.randomUUID()
      await database
        .insertInto('user')
        .values([
          {
            id: early,
            name: 'Early',
            email: 'early@example.com',
            emailVerified: true,
            createdAt: '2026-11-01T00:00:00.000Z'
          },
          {
            id: late,
            name: 'Late',
            email: 'late@example.com',
            emailVerified: true,
            createdAt: '2026-11-03T23:59:59.000Z'
          }
        ])
        .execute()
      const workspaceId = crypto.randomUUID()
      await database
        .insertInto('workspace')
        .values({ id: workspaceId, name: 'W', slug: 'w', createdBy: early, ownerId: early })
        .execute()
      const documentId = crypto.randomUUID()
      const trashedId = crypto.randomUUID()
      await database
        .insertInto('document')
        .values([
          {
            id: documentId,
            workspaceId,
            name: 'Kept',
            currentRevisionId: null,
            createdBy: early,
            createdAt: '2026-11-01T10:00:00.000Z'
          },
          {
            id: trashedId,
            workspaceId,
            name: 'Trashed',
            currentRevisionId: null,
            createdBy: early,
            createdAt: '2026-11-03T10:00:00.000Z',
            deletedAt: '2026-11-04T10:00:00.000Z'
          }
        ])
        .execute()
      const objectId = crypto.randomUUID()
      await database
        .insertInto('storageObject')
        .values({
          id: objectId,
          objectKey: 'k',
          checksum: 'c',
          byteSize: 10,
          contentType: 'application/octet-stream'
        })
        .execute()
      const revision = (createdBy: string, createdAt: string) => ({
        id: crypto.randomUUID(),
        documentId,
        parentRevisionId: null,
        storageObjectId: objectId,
        createdBy,
        createdAt
      })
      await database
        .insertInto('documentRevision')
        .values([
          revision(early, '2026-11-01T11:00:00.000Z'),
          revision(early, '2026-11-01T12:00:00.000Z'),
          revision(late, '2026-11-03T23:59:59.000Z')
        ])
        .execute()
      // Early signs in on the day they also save: still one active account that day.
      await database
        .insertInto('signIn')
        .values([
          {
            id: crypto.randomUUID(),
            userId: early,
            method: 'password',
            createdAt: '2026-11-01T09:00:00.000Z'
          },
          {
            id: crypto.randomUUID(),
            userId: late,
            method: 'password',
            createdAt: '2026-11-01T09:00:00.000Z'
          }
        ])
        .execute()
      await database
        .insertInto('workspaceStorageUsage')
        .values({ workspaceId, committedBytes: 1234 })
        .execute()

      const response = await usage(context, 'start=2026-11-01&end=2026-11-03')
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        days: [
          {
            day: '2026-11-01',
            signUps: 1,
            activeAccounts: 2,
            documentsCreated: 1,
            revisions: 2
          },
          { day: '2026-11-02', signUps: 0, activeAccounts: 0, documentsCreated: 0, revisions: 0 },
          { day: '2026-11-03', signUps: 1, activeAccounts: 1, documentsCreated: 1, revisions: 1 }
        ],
        totals: { accounts: 3, documents: 1, workspaces: 1, storageBytes: 1234 }
      })
    } finally {
      await context.runtime.close()
    }
  })

  test('refuses callers without the service token, and ranges it cannot answer', async () => {
    const context = await testApp()
    try {
      expect((await usage(context, 'start=2026-11-01&end=2026-11-01', 'x'.repeat(48))).status).toBe(
        401
      )
      for (const query of [
        'start=2026-11-03&end=2026-11-01',
        'start=2026-02-30&end=2026-03-01',
        'start=2025-01-01&end=2026-11-01',
        'start=yesterday&end=2026-11-01',
        'end=2026-11-01'
      ]) {
        const response = await usage(context, query)
        expect({ query, status: response.status }).toEqual({ query, status: 400 })
      }
      expect((await usage(context, 'start=2026-11-01&end=2026-11-01')).status).toBe(200)
    } finally {
      await context.runtime.close()
    }
  })
})
