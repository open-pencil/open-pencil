import { describe, expect, test } from 'bun:test'

import { ignoredSecurityNotices } from '#cloud-tests/helpers/account-authentication'
import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import { cloudAccountStatusResponseSchema } from '#cloud/contract'
import {
  createBetterAuthAdapter,
  createCloudApp,
  createEnrollmentService,
  createTransactionalEmailService,
  parseCloudServerConfig,
  type CloudServerConfig
} from '#cloud/server'
import { createTermsService } from '#cloud/server/account/terms'
import * as v from 'valibot'

const errorSchema = v.object({ error: v.object({ code: v.string() }) })

const base = {
  deployment: 'self-hosted',
  publicURL: 'https://cloud.example.com',
  databaseURL: 'postgresql://test:test@localhost/test',
  authSecret: 'terms-test-secret-at-least-32-characters-long',
  emailPasswordEnabled: true,
  emailPasswordMinimumLength: 15,
  emailTransport: 'smtp',
  emailFrom: 'cloud@example.com',
  smtpHost: 'smtp.example.com',
  smtpPort: 465,
  smtpSecure: true,
  s3Endpoint: 'https://objects.example.com',
  s3Region: 'us-east-1',
  s3Bucket: 'openpencil',
  s3AccessKeyId: 'access-key',
  s3SecretAccessKey: 'secret-key'
} as const

const legal = {
  termsURL: 'https://example.com/terms',
  privacyURL: 'https://example.com/privacy',
  termsVersion: '2026-11-15',
  requireAcceptance: true
}

const requiring = parseCloudServerConfig({ ...base, legal })
const person = { userId: 'person', email: 'person@example.com', name: 'Person' }

async function appFor(config: CloudServerConfig) {
  const runtime = await createCloudTestDatabase()
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: createBetterAuthAdapter(config, runtime.database),
    objects: {} as never,
    resolveIdentity: async () => person
  })
  return { ...runtime, app }
}

function accept(
  app: { request: (path: string, init: RequestInit) => Response | Promise<Response> },
  version: string
) {
  return app.request('/api/account/terms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base.publicURL },
    body: JSON.stringify({ version })
  })
}

/** Signs up and in with a password on a deployment that requires the terms, before accepting. */
async function signedUp(runtime: Awaited<ReturnType<typeof createCloudTestDatabase>>) {
  let verificationURL = ''
  const email = createTransactionalEmailService(runtime.database, {
    encryptionSecret: requiring.authSecret,
    from: 'cloud@example.com'
  })
  const enrollment = createEnrollmentService(runtime.database, {
    publicURL: requiring.publicURL,
    adminRecipients: [],
    email
  })
  const auth = createBetterAuthAdapter(requiring, runtime.database, enrollment, {
    email: {
      ...ignoredSecurityNotices,
      async sendVerification(input) {
        verificationURL = input.url
      },
      sendPasswordReset: async () => undefined,
      sendPasswordChanged: async () => undefined
    }
  })
  const post = (path: string, body: object) =>
    auth.handler(
      new Request(new URL(`/api/auth${path}`, requiring.publicURL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: requiring.publicURL },
        body: JSON.stringify(body)
      })
    )
  const credentials = { email: 'person@example.com', password: 'a sufficiently long password' }
  await post('/sign-up/email', { ...credentials, name: 'Person' })
  await auth.handler(new Request(verificationURL))
  const signIn = await post('/sign-in/email', credentials)
  const cookie = signIn.headers.get('set-cookie')?.split(';', 1)[0] ?? ''
  return { auth, headers: new Headers({ Cookie: cookie }) }
}

describe('terms acceptance', () => {
  test('holds an account at its terms until it accepts the current version', async () => {
    const { app, database, close } = await appFor(requiring)
    try {
      expect(
        await responseJSON(
          await app.request('/api/account/status'),
          cloudAccountStatusResponseSchema
        )
      ).toMatchObject({
        state: 'terms'
      })
      const stale = await accept(app, '2026-01-01')
      expect(stale.status).toBe(409)
      expect(await responseJSON(stale, errorSchema)).toEqual({ error: { code: 'terms_changed' } })

      expect((await accept(app, legal.termsVersion)).status).toBe(200)
      expect((await accept(app, legal.termsVersion)).status).toBe(200)
      expect(
        await responseJSON(
          await app.request('/api/account/status'),
          cloudAccountStatusResponseSchema
        )
      ).toMatchObject({
        state: 'active'
      })
      expect(
        await database.selectFrom('termsAcceptance').select(['userId', 'version']).execute()
      ).toEqual([{ userId: 'person', version: legal.termsVersion }])
    } finally {
      await close()
    }
  })

  test('asks again when the terms version changes', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const first = createTermsService(runtime.database, requiring)
      expect(await first.accept('person', legal.termsVersion)).toBe(true)
      const changed = createTermsService(
        runtime.database,
        parseCloudServerConfig({ ...base, legal: { ...legal, termsVersion: '2027-01-01' } })
      )
      expect(await first.hasAccepted('person')).toBe(true)
      expect(await changed.hasAccepted('person')).toBe(false)
    } finally {
      await runtime.close()
    }
  })

  test('asks nothing of a deployment that requires no acceptance', async () => {
    const { app, close } = await appFor(
      parseCloudServerConfig({ ...base, legal: { ...legal, requireAcceptance: false } })
    )
    try {
      expect(
        await responseJSON(
          await app.request('/api/account/status'),
          cloudAccountStatusResponseSchema
        )
      ).toMatchObject({
        state: 'active'
      })
      expect((await accept(app, legal.termsVersion)).status).toBe(404)
    } finally {
      await close()
    }
  })

  test('lets an account with terms to accept read its documents, and nothing else', async () => {
    const runtime = await createCloudTestDatabase()
    const objects = createMemoryObjectStore()
    let accepted = true
    try {
      const app = createCloudApp({
        config: requiring,
        database: runtime.database,
        auth: createBetterAuthAdapter(requiring, runtime.database),
        objects: objects.store,
        resolveIdentity: async () => person,
        resolveSession: async () => (accepted ? person : null),
        resolveAccountSession: async () => person
      })
      const post = (path: string, body: object) =>
        app.request(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      const { workspace } = await responseJSON(
        await post('/api/workspaces', { name: 'Studio', slug: 'studio' }),
        v.object({ workspace: v.object({ id: v.string() }) })
      )
      const { document } = await responseJSON(
        await post(`/api/workspaces/${workspace.id}/documents`, { name: 'Homepage' }),
        v.object({ document: v.object({ id: v.string() }) })
      )
      // One save, as the editor makes it: an upload, then its commit.
      const checksum = `${'A'.repeat(43)}=`
      const upload = await responseJSON(
        await post(`/api/documents/${document.id}/uploads`, {
          baseRevisionId: null,
          byteSize: 16,
          checksum,
          contentType: 'application/octet-stream'
        }),
        v.object({ id: v.string() })
      )
      const { objectKey } = await runtime.database
        .selectFrom('upload')
        .select('objectKey')
        .where('id', '=', upload.id)
        .executeTakeFirstOrThrow()
      objects.put(objectKey, {
        byteSize: 16,
        checksum,
        checksumVerification: 'native',
        contentType: 'application/octet-stream'
      })
      expect((await post(`/api/uploads/${upload.id}/commit`, { checksum })).status).toBe(200)

      // Someone else joins, so this account is the workspace's only admin: deleting it waits for
      // a handover, and the plan must still list what it made there.
      await runtime.database
        .insertInto('workspaceMember')
        .values({ workspaceId: workspace.id, userId: 'teammate', role: 'editor' })
        .execute()

      // Then the terms change, and this account has not accepted them yet.
      accepted = false
      const deletion = await responseJSON(
        await app.request('/api/account/deletion'),
        v.object({
          deletion: v.object({
            blockedBy: v.array(v.object({ id: v.string() })),
            documents: v.array(v.object({ id: v.string() }))
          })
        })
      )
      expect(deletion.deletion.blockedBy.map((entry) => entry.id)).toEqual([workspace.id])
      expect(deletion.deletion.documents.map((entry) => entry.id)).toEqual([document.id])
      expect((await app.request(`/api/documents/${document.id}`)).status).toBe(200)

      expect((await app.request('/api/workspaces')).status).toBe(401)
      expect((await app.request(`/api/documents/${document.id}/versions`)).status).toBe(401)
      expect(
        (await app.request(`/api/documents/${document.id}`, { method: 'DELETE' })).status
      ).toBe(401)
      expect(
        (await post(`/api/workspaces/${workspace.id}/documents`, { name: 'Other' })).status
      ).toBe(401)
    } finally {
      await runtime.close()
    }
  })

  test('gives a signed-in account no session until it accepts', async () => {
    const runtime = await createCloudTestDatabase()
    const { auth, headers } = await signedUp(runtime)
    try {
      const identity = await auth.resolveIdentity(headers)
      expect(identity).toMatchObject({ email: 'person@example.com' })
      expect(await auth.resolveSession(headers)).toBeNull()
      expect(await auth.resolveAccountSession(headers)).toMatchObject({
        email: 'person@example.com'
      })

      await createTermsService(runtime.database, requiring).accept(
        identity?.userId ?? '',
        legal.termsVersion
      )
      expect(await auth.resolveSession(headers)).toMatchObject({ email: 'person@example.com' })
    } finally {
      await runtime.close()
    }
  })

  test('lets an account with terms to accept delete itself', async () => {
    const runtime = await createCloudTestDatabase()
    const { auth, headers } = await signedUp(runtime)
    try {
      const app = createCloudApp({
        config: requiring,
        database: runtime.database,
        auth,
        objects: createMemoryObjectStore().store
      })
      expect(await auth.resolveSession(headers)).toBeNull()
      const response = await app.request('/api/account/delete', {
        method: 'POST',
        headers: new Headers([
          ...headers,
          ['Content-Type', 'application/json'],
          ['Origin', requiring.publicURL]
        ]),
        body: JSON.stringify({})
      })
      expect(response.status).toBe(200)
      expect(
        await runtime.database
          .selectFrom('user')
          .select('id')
          .where('email', '=', 'person@example.com')
          .executeTakeFirst()
      ).toBeUndefined()
    } finally {
      await runtime.close()
    }
  })
})

describe('[legal] configuration', () => {
  test('requires terms and a version to require acceptance', () => {
    expect(() =>
      parseCloudServerConfig({
        ...base,
        legal: { requireAcceptance: true, termsURL: legal.termsURL }
      })
    ).toThrow('terms_version')
  })
})
