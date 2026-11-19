import { afterEach, describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  createBetterAuthAdapter,
  createCloudApp,
  createTransactionalEmailService,
  parseCloudServerConfig,
  type CloudActor,
  type TransactionalEmailService
} from '#cloud/server'
import { decryptTransactionalEmailPayload } from '#cloud/server/email'
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
const EMAIL_SECRET = 'notice-test-secret-at-least-32-characters'
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
 * Google account and password (set before passwords were turned off) are both on file. `email`
 * wraps the server's email queue, as a test that reads what it sends needs.
 */
async function server(
  userId: string,
  name: string,
  email: (queue: TransactionalEmailService) => TransactionalEmailService = (queue) => queue
) {
  const runtime = await createCloudTestDatabase()
  opened.push(runtime)
  const queue = createTransactionalEmailService(runtime.database, {
    encryptionSecret: EMAIL_SECRET,
    from: 'cloud@example.com'
  })
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
      resolveSession: async () => ada,
      transactionalEmail: email(queue)
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
  const queued = () =>
    runtime.database
      .selectFrom('transactionalEmail')
      .select(['id', 'kind', 'recipientEmailNormalized as recipient', 'payloadEncrypted'])
      .execute()
  // Grace's request to join, in whatever state a test needs.
  const request = (status: 'pending' | 'approved' | 'rejected') =>
    runtime.database
      .insertInto('enrollment')
      .values({
        id: crypto.randomUUID(),
        emailNormalized: `${name.toLowerCase()}@example.com`,
        name,
        reason: null,
        status,
        requestedAt: new Date(),
        reviewedAt: status === 'pending' ? null : new Date(),
        reviewedBy: null,
        reviewNote: null,
        approvedUserId: null
      })
      .execute()
  return {
    password,
    google,
    remove,
    left,
    offered,
    queued,
    admin,
    request,
    database: runtime.database
  }
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

  test('queue the removal’s notice in its transaction, so neither outlives the other', async () => {
    // The queue takes the first notice, then fails: the removal must go with it.
    let failing = true
    let failedAfterQueueing = false
    const { password, remove, left, queued } = await server(GRACE_ID, 'Grace', (queue) => ({
      ...queue,
      async enqueue(input, transaction) {
        const id = await queue.enqueue(input, transaction)
        if (failing) {
          failedAfterQueueing = true
          throw new Error('after the notice')
        }
        return id
      }
    }))
    expect((await remove(password.id)).status).toBe(500)
    expect(failedAfterQueueing).toBe(true)
    expect(await queued()).toEqual([])
    expect(await left()).toHaveLength(2)

    failing = false
    expect((await remove(password.id)).status).toBe(200)
    expect(await left()).toEqual(['google'])
    const notices = await queued()
    expect(notices).toHaveLength(1)
    const [notice] = notices
    expect(notice).toMatchObject({ kind: 'two-step-changed', recipient: 'grace@example.com' })
    if (!notice?.payloadEncrypted) throw new Error('The removal queued no notice')
    // Read the sealed payload back as delivery would.
    const content = await decryptTransactionalEmailPayload(
      EMAIL_SECRET,
      notice.id,
      'two-step-changed',
      notice.payloadEncrypted
    )
    expect(content.payload).toMatchObject({
      name: 'Grace',
      change: 'sign-in-method-removed',
      method: 'credential'
    })
  })

  test('delete an account whose request was never approved, and name it in the activity', async () => {
    const { admin, request, database } = await server(GRACE_ID, 'Grace')
    await request('pending')

    const deleted = await admin.users.delete.$post({ json: { userId: GRACE_ID } })
    expect(deleted.status).toBe(200)
    // The account goes with its sign-in methods and its request.
    expect(
      await database.selectFrom('user').select('id').where('id', '=', GRACE_ID).execute()
    ).toEqual([])
    expect(
      await database.selectFrom('account').select('id').where('userId', '=', GRACE_ID).execute()
    ).toEqual([])
    expect(await database.selectFrom('enrollment').select('id').execute()).toEqual([])
    const activity = await responseJSON(
      await admin.audit.$get({ query: {} }),
      v.object({
        events: v.array(
          v.object({ action: v.string(), subject: v.object({ name: v.nullable(v.string()) }) })
        )
      })
    )
    expect(activity.events).toEqual([
      expect.objectContaining({ action: 'user.deleted', subject: { name: 'Grace' } })
    ])
  })

  test('refuse to delete an account that was approved', async () => {
    const { admin, request, database } = await server(GRACE_ID, 'Grace')
    await request('approved')

    const refused = await admin.users.delete.$post({ json: { userId: GRACE_ID } })
    expect(refused.status).toBe(409)
    expect(await responseJSON(refused, answerSchema)).toEqual({
      error: { code: 'account_approved' }
    })
    expect(
      await database.selectFrom('user').select('id').where('id', '=', GRACE_ID).execute()
    ).toHaveLength(1)
    expect(await database.selectFrom('adminAuditEvent').select('id').execute()).toEqual([])
  })

  test('refuse to delete an account that was approved once, even while it waits again', async () => {
    const { admin, request, database } = await server(GRACE_ID, 'Grace')
    // Approved and bound to the account, then removed, and asked again: pending, not new.
    await request('pending')
    await database.updateTable('enrollment').set({ approvedUserId: GRACE_ID }).execute()

    const refused = await admin.users.delete.$post({ json: { userId: GRACE_ID } })
    expect(refused.status).toBe(409)
    expect(
      await database.selectFrom('user').select('id').where('id', '=', GRACE_ID).execute()
    ).toHaveLength(1)
  })
})
