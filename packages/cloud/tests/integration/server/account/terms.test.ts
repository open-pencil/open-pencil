import { describe, expect, test } from 'bun:test'

import { ignoredSecurityNotices } from '#cloud-tests/helpers/account-authentication'
import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
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

  test('lets an account with terms to accept leave, and nothing else', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const app = createCloudApp({
        config: requiring,
        database: runtime.database,
        auth: createBetterAuthAdapter(requiring, runtime.database),
        objects: {} as never,
        resolveIdentity: async () => person,
        resolveSession: async () => null,
        resolveAccountSession: async () => person
      })
      const unknownDocument = '00000000-0000-4000-8000-000000000000'
      // What leaving needs: what deleting the account takes, and each document to download.
      expect((await app.request('/api/account/deletion')).status).toBe(200)
      expect((await app.request(`/api/documents/${unknownDocument}`)).status).toBe(404)
      // Everything else waits for the terms.
      expect((await app.request('/api/workspaces')).status).toBe(401)
      expect((await app.request(`/api/documents/${unknownDocument}/versions`)).status).toBe(401)
      expect(
        (await app.request(`/api/documents/${unknownDocument}`, { method: 'DELETE' })).status
      ).toBe(401)
    } finally {
      await runtime.close()
    }
  })

  test('gives a signed-in account no session until it accepts', async () => {
    let verificationURL = ''
    const runtime = await createCloudTestDatabase()
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
    try {
      await post('/sign-up/email', { ...credentials, name: 'Person' })
      await auth.handler(new Request(verificationURL))
      const signIn = await post('/sign-in/email', credentials)
      const cookie = signIn.headers.get('set-cookie')?.split(';', 1)[0] ?? ''
      const headers = new Headers({ Cookie: cookie })

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
