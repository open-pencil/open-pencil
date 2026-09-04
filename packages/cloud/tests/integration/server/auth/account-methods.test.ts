import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-test/helpers/database'
import * as v from 'valibot'

import { cloudAuthenticationMethodsResponseSchema } from '@open-pencil/cloud/contract'
import {
  createCloudApp,
  createBetterAuthAdapter,
  parseCloudServerConfig
} from '@open-pencil/cloud/server'

const config = parseCloudServerConfig({
  deployment: 'self-hosted',
  publicURL: 'https://cloud.example.com',
  databaseURL: 'postgresql://test:test@localhost/test',
  authSecret: 'account-authentication-test-secret-at-least-32-characters',
  enrollmentMode: 'approval',
  emailPasswordEnabled: true,
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
})

async function ignore(): Promise<void> {
  await Promise.resolve()
}

function request(path: string, body?: object, cookie?: string): Request {
  const headers = new Headers()
  if (body) headers.set('Content-Type', 'application/json')
  if (cookie) headers.set('Cookie', cookie)
  return new Request(new URL(path, config.publicURL), {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
}

function cookie(response: Response): string {
  const value = response.headers.get('set-cookie')?.split(';', 1)[0]
  if (!value) throw new Error('Authentication response did not set a cookie')
  return value
}

function objects() {
  return {
    capabilities: { nativeSHA256: true, multipartUpload: false, conditionalWrites: false },
    async checkReadiness() {
      return { ok: true, checksumVerification: 'native' as const }
    },
    async createDownload() {
      throw new Error('not used')
    },
    async createUpload() {
      throw new Error('not used')
    },
    completeUpload: ignore,
    abortUpload: ignore,
    async head() {
      return null
    },
    delete: ignore
  }
}

describe('account authentication methods', () => {
  test('changes passwords, revokes other sessions, and retains multiple authentication methods', async () => {
    let passwordChanged = false
    const runtime = await createCloudTestDatabase()
    try {
      const auth = createBetterAuthAdapter(config, runtime.database, undefined, {
        email: {
          sendVerification: ignore,
          sendPasswordReset: ignore,
          async sendPasswordChanged() {
            passwordChanged = true
          }
        }
      })
      const app = createCloudApp({ config, database: runtime.database, auth, objects: objects() })
      await app.fetch(
        request('/api/auth/sign-up/email', {
          name: 'Active Person',
          email: 'active@example.com',
          password: 'the original long password'
        })
      )
      const user = await runtime.database
        .selectFrom('user')
        .select('id')
        .where('email', '=', 'active@example.com')
        .executeTakeFirstOrThrow()
      await runtime.database
        .updateTable('user')
        .set({ emailVerified: true })
        .where('id', '=', user.id)
        .execute()
      await runtime.database
        .insertInto('cloudEnrollment')
        .values({
          id: crypto.randomUUID(),
          emailNormalized: 'active@example.com',
          name: 'Active Person',
          reason: null,
          status: 'approved',
          reviewedAt: new Date(),
          reviewedBy: 'admin',
          reviewNote: null,
          approvedUserId: user.id
        })
        .execute()
      await runtime.database
        .insertInto('account')
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          providerId: 'google',
          issuer: 'https://accounts.google.com',
          accountId: 'google-account',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .execute()
      const firstSignIn = await app.fetch(
        request('/api/auth/sign-in/email', {
          email: 'active@example.com',
          password: 'the original long password'
        })
      )
      const currentCookie = cookie(firstSignIn)
      await app.fetch(
        request('/api/auth/sign-in/email', {
          email: 'active@example.com',
          password: 'the original long password'
        })
      )
      const before = await runtime.database
        .selectFrom('session')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('userId', '=', user.id)
        .executeTakeFirstOrThrow()
      expect(Number(before.count)).toBeGreaterThan(1)

      const methods = await app.fetch(
        request('/api/account/authentication', undefined, currentCookie)
      )
      const methodBody = v.parse(cloudAuthenticationMethodsResponseSchema, await methods.json())
      expect(methodBody.methods).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ provider: 'credential', canUnlink: true }),
          expect.objectContaining({ provider: 'google', canUnlink: true })
        ])
      )
      expect(methodBody.availableSocialProviders).toEqual([])
      const google = methodBody.methods.find((method) => method.provider === 'google')
      if (!google) throw new Error('Expected a linked Google method')
      const unlink = await app.fetch(
        request('/api/account/authentication/unlink', { methodId: google.id }, currentCookie)
      )
      expect(unlink.status).toBe(200)

      const changed = await app.fetch(
        request(
          '/api/account/authentication/change-password',
          {
            currentPassword: 'the original long password',
            newPassword: 'the replacement long password'
          },
          currentCookie
        )
      )
      expect(changed.status).toBe(200)
      expect(passwordChanged).toBe(true)
      const after = await runtime.database
        .selectFrom('session')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('userId', '=', user.id)
        .executeTakeFirstOrThrow()
      expect(Number(after.count)).toBe(1)
    } finally {
      await runtime.close()
    }
  })

  test('blocks restricted identities and protects the final sign-in method', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const auth = createBetterAuthAdapter(config, runtime.database)
      const app = createCloudApp({ config, database: runtime.database, auth, objects: objects() })
      const signUp = await app.fetch(
        request('/api/auth/sign-up/email', {
          name: 'Person',
          email: 'person@example.com',
          password: 'a sufficiently long password'
        })
      )
      expect(signUp.status).toBe(200)
      await runtime.database
        .updateTable('user')
        .set({ emailVerified: true })
        .where('email', '=', 'person@example.com')
        .execute()
      const signIn = await app.fetch(
        request('/api/auth/sign-in/email', {
          email: 'person@example.com',
          password: 'a sufficiently long password'
        })
      )
      const sessionCookie = cookie(signIn)

      expect(
        (await app.fetch(request('/api/account/authentication', undefined, sessionCookie))).status
      ).toBe(401)
      expect(
        (await app.fetch(request('/api/auth/list-accounts', undefined, sessionCookie))).status
      ).toBe(401)
      expect(
        (
          await app.fetch(
            request(
              '/api/account/authentication/change-password',
              {
                currentPassword: 'a sufficiently long password',
                newPassword: 'a different long password'
              },
              sessionCookie
            )
          )
        ).status
      ).toBe(401)

      await runtime.database
        .insertInto('cloudEnrollment')
        .values({
          id: crypto.randomUUID(),
          emailNormalized: 'person@example.com',
          name: 'Person',
          reason: null,
          status: 'approved',
          reviewedAt: new Date(),
          reviewedBy: 'admin',
          reviewNote: null,
          approvedUserId: null
        })
        .execute()
      const methods = await app.fetch(
        request('/api/account/authentication', undefined, sessionCookie)
      )
      expect(methods.status).toBe(200)
      const body = await methods.json()
      expect(body.methods).toHaveLength(1)
      expect(body.methods[0]).toMatchObject({ provider: 'credential', canUnlink: false })
      const unlink = await app.fetch(
        request(
          '/api/account/authentication/unlink',
          { methodId: body.methods[0].id },
          sessionCookie
        )
      )
      expect(unlink.status).toBe(400)
    } finally {
      await runtime.close()
    }
  })
})
