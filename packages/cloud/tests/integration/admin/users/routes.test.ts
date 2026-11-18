import { afterEach, describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  createBetterAuthAdapter,
  createCloudApp,
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
  s3SecretAccessKey: 'openpencil-secret',
  googleClientId: 'google-client',
  googleClientSecret: 'google-secret'
})

/** What the route answers: done, or refused with a code. */
const answerSchema = v.union([
  v.object({ ok: v.literal(true) }),
  v.object({ error: v.object({ code: v.string() }) })
])

const ADMIN_ID = 'aaaaaaaa-1111-4111-8111-111111111111'
const GRACE_ID = 'bbbbbbbb-2222-4222-8222-222222222222'
const ada: CloudActor = {
  userId: ADMIN_ID,
  email: 'ada@example.com',
  name: 'Ada',
  deploymentRole: 'admin'
}

const opened: { close(): Promise<void> }[] = []
afterEach(async () => {
  for (const runtime of opened.splice(0)) await runtime.close()
})

/**
 * Ada's server, which signs in with Google and not with passwords, and one person on it whose
 * Google account and password (set before passwords were turned off) are both on file.
 */
async function server(userId: string, name: string) {
  const runtime = await createCloudTestDatabase()
  opened.push(runtime)
  await runtime.database
    .insertInto('user')
    .values({ id: userId, name, email: `${name.toLowerCase()}@example.com`, emailVerified: true })
    .execute()
  const [password, google] = ['credential', 'google'].map((providerId) => ({
    id: crypto.randomUUID(),
    userId,
    providerId,
    accountId: crypto.randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date()
  }))
  if (!password || !google) throw new Error('two methods')
  await runtime.database.insertInto('account').values([password, google]).execute()
  const admin = testClient(
    createCloudApp({
      config,
      database: runtime.database,
      auth: createBetterAuthAdapter(config, runtime.database),
      objects: createMemoryObjectStore().store,
      resolveSession: async () => ada
    }),
    undefined,
    undefined,
    { headers: { Origin: config.publicURL } }
  ).api.admin
  // The raw answer, so a refusal's status is checked along with its body.
  const remove = (methodId: string, spelling = userId) =>
    admin.users['remove-sign-in-method'].$post({ json: { userId: spelling, methodId } })
  const left = async () =>
    (
      await runtime.database
        .selectFrom('account')
        .select('providerId')
        .where('userId', '=', userId)
        .execute()
    ).map((method) => method.providerId)
  const offered = async () => {
    const detail = await responseJSON(
      await admin.users[':id'].$get({ param: { id: userId } }),
      v.object({ methods: v.array(v.object({ provider: v.string(), canRemove: v.boolean() })) })
    )
    return detail.methods.map((method) => [method.provider, method.canRemove])
  }
  return { password, google, remove, left, offered }
}

describe('admin people routes', () => {
  test('refuse an administrator’s own account however its ID is spelled', async () => {
    const { google, remove, left } = await server(ADMIN_ID, 'Ada')
    // The database matches a UUID in any case; the console's own-account rule has to as well.
    const response = await remove(google.id, ADMIN_ID.toUpperCase())
    expect(response.status).toBe(400)
    expect(await responseJSON(response, answerSchema)).toEqual({
      error: { code: 'self_admin_action_forbidden' }
    })
    expect(await left()).toHaveLength(2)
  })

  test('keep the last method whose provider the server still signs in with', async () => {
    const { password, google, remove, left, offered } = await server(GRACE_ID, 'Grace')
    // The console offers to remove only what the server would.
    expect(await offered()).toEqual(
      expect.arrayContaining([
        ['credential', true],
        ['google', false]
      ])
    )
    // Her Google account is the only way in that still works.
    const refused = await remove(google.id)
    expect(refused.status).toBe(400)
    expect(await responseJSON(refused, answerSchema)).toEqual({
      error: { code: 'last_authentication_method' }
    })
    // The password lets no one in, so taking it away changes nothing.
    const removed = await remove(password.id)
    expect(removed.status).toBe(200)
    expect(await responseJSON(removed, answerSchema)).toEqual({ ok: true })
    expect(await left()).toEqual(['google'])
  })
})
