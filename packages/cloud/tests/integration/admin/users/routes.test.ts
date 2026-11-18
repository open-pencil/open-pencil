import { afterEach, describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import {
  createBetterAuthAdapter,
  createCloudApp,
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
  s3SecretAccessKey: 'openpencil-secret',
  googleClientId: 'google-client',
  googleClientSecret: 'google-secret'
})

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
  const remove = async (methodId: string, spelling = userId) =>
    (
      await admin.users['remove-sign-in-method'].$post({ json: { userId: spelling, methodId } })
    ).json()
  const left = async () =>
    (
      await runtime.database
        .selectFrom('account')
        .select('providerId')
        .where('userId', '=', userId)
        .execute()
    ).map((method) => method.providerId)
  return { password, google, remove, left }
}

describe('admin people routes', () => {
  test('refuse an administrator’s own account however its ID is spelled', async () => {
    const { google, remove, left } = await server(ADMIN_ID, 'Ada')
    // The database matches a UUID in any case; the console's own-account rule has to as well.
    expect(await remove(google.id, ADMIN_ID.toUpperCase())).toEqual({
      error: { code: 'self_admin_action_forbidden' }
    })
    expect(await left()).toHaveLength(2)
  })

  test('keep the last method whose provider the server still signs in with', async () => {
    const { password, google, remove, left } = await server(GRACE_ID, 'Grace')
    // Her Google account is the only way in that still works.
    expect(await remove(google.id)).toEqual({ error: { code: 'last_authentication_method' } })
    // The password lets no one in, so taking it away changes nothing.
    expect(await remove(password.id)).toEqual({ ok: true })
    expect(await left()).toEqual(['google'])
  })
})
