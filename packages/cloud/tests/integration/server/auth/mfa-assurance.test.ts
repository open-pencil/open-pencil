import { describe, expect, test } from 'bun:test'

import {
  accountAuthenticationRequest,
  authenticationCookie,
  createAccountAuthenticationFixture,
  createVerifiedCredentialAccount
} from '#cloud-tests/helpers/account-authentication'
import { responseJSON } from '#cloud-tests/helpers/response'
import { parseCloudServerConfig } from '#cloud/server'
import { base32 } from '@better-auth/utils/base32'
import { createOTP } from '@better-auth/utils/otp'
import { sql } from 'kysely'
import * as v from 'valibot'

const mfaConfig = parseCloudServerConfig({
  deployment: 'self-hosted',
  publicURL: 'https://cloud.example.com',
  databaseURL: 'postgresql://test:test@localhost/test',
  authSecret: 'mfa-assurance-test-secret-at-least-32-characters',
  enrollmentMode: 'approval',
  deploymentAdminMFARequired: true,
  totpEnabled: true,
  recoveryCodesEnabled: true,
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

describe('deployment administrator MFA assurance', () => {
  test('requires and records TOTP step-up before admin access', async () => {
    const fixture = await createAccountAuthenticationFixture({ config: mfaConfig })
    try {
      const account = await createVerifiedCredentialAccount(fixture, {
        email: 'admin@example.com',
        name: 'Admin',
        password: 'a sufficiently long password',
        approved: true
      })
      await fixture.database
        .updateTable('user')
        .set({ role: 'admin' })
        .where('id', '=', account.userId)
        .execute()
      const signIn = await fixture.app.fetch(
        accountAuthenticationRequest('/api/auth/sign-in/email', {
          email: 'admin@example.com',
          password: 'a sufficiently long password'
        })
      )
      const sessionCookie = authenticationCookie(signIn)
      expect(
        (
          await fixture.app.fetch(
            accountAuthenticationRequest('/api/admin/operations', undefined, sessionCookie)
          )
        ).status
      ).toBe(403)

      const enabled = await fixture.app.fetch(
        accountAuthenticationRequest(
          '/api/account/mfa/totp/enable',
          { password: 'a sufficiently long password' },
          sessionCookie
        )
      )
      const setup = await responseJSON(enabled, v.object({ totpURI: v.string() }))
      const secret = new URL(setup.totpURI).searchParams.get('secret')
      if (!secret) throw new Error('Expected a TOTP secret')
      const rawSecret = new TextDecoder().decode(base32.decode(secret))
      const code = await createOTP(rawSecret).totp()
      const verificationResponse = await fixture.app.fetch(
        accountAuthenticationRequest('/api/account/mfa/totp/verify', { code }, sessionCookie)
      )
      expect(verificationResponse.status).toBe(200)
      const setCookie = verificationResponse.headers.get('set-cookie')
      if (!setCookie) throw new Error('Expected a verified MFA session cookie')
      const cookieMatch = setCookie.match(/(?:^|,\s*)([^;,]*better-auth\.session_token=[^;]+)/)
      const verifiedCookie = cookieMatch?.[1]
      if (!verifiedCookie) throw new Error('Expected a verified MFA session cookie')
      expect(
        (
          await fixture.app.fetch(
            accountAuthenticationRequest('/api/admin/operations', undefined, verifiedCookie)
          )
        ).status
      ).toBe(200)

      expect(
        (
          await fixture.app.fetch(
            accountAuthenticationRequest(
              '/api/account/mfa/totp/disable',
              { password: 'a sufficiently long password' },
              verifiedCookie
            )
          )
        ).status
      ).toBe(403)
      expect(
        (
          await fixture.app.fetch(
            accountAuthenticationRequest(
              '/api/auth/two-factor/disable',
              { password: 'a sufficiently long password' },
              verifiedCookie
            )
          )
        ).status
      ).toBe(404)
    } finally {
      await fixture.close()
    }
  })

  test('keeps an administrator from deleting their last second factor', async () => {
    const fixture = await createAccountAuthenticationFixture({ config: mfaConfig })
    try {
      const account = await createVerifiedCredentialAccount(fixture, {
        email: 'passkey-admin@example.com',
        name: 'Passkey Admin',
        password: 'a sufficiently long password',
        approved: true
      })
      await fixture.database
        .updateTable('user')
        .set({ role: 'admin' })
        .where('id', '=', account.userId)
        .execute()
      const addPasskey = async (credential: string) => {
        const id = crypto.randomUUID()
        await sql`
          insert into passkey (id, name, public_key, user_id, credential_id, counter, device_type, backed_up)
          values (${id}, ${credential}, 'public-key', ${account.userId}, ${credential}, 0, 'singleDevice', false)
        `.execute(fixture.database)
        return id
      }
      const deletePasskey = (id: string) =>
        fixture.app.fetch(
          accountAuthenticationRequest(
            '/api/account/mfa/passkeys/delete',
            { id },
            account.sessionCookie
          )
        )

      const only = await addPasskey('only')
      const refused = await deletePasskey(only)
      expect(refused.status).toBe(403)
      expect(await refused.json()).toEqual({ error: { code: 'mfa_required' } })

      const spare = await addPasskey('spare')
      expect((await deletePasskey(only)).status).toBe(200)
      expect((await deletePasskey(spare)).status).toBe(403)
    } finally {
      await fixture.close()
    }
  })

  test('refuses Better Auth admin endpoints outside the Cloud admin API', async () => {
    const fixture = await createAccountAuthenticationFixture({ config: mfaConfig })
    try {
      const account = await createVerifiedCredentialAccount(fixture, {
        email: 'direct-admin@example.com',
        name: 'Direct Admin',
        password: 'a sufficiently long password',
        approved: true
      })
      await fixture.database
        .updateTable('user')
        .set({ role: 'admin' })
        .where('id', '=', account.userId)
        .execute()
      for (const path of ['/api/auth/admin/set-role', '/api/auth/admin/impersonate-user']) {
        const response = await fixture.app.fetch(
          accountAuthenticationRequest(
            path,
            { userId: account.userId, role: 'user' },
            account.sessionCookie
          )
        )
        // Cloud does not serve Better Auth's own administration at all.
        expect(response.status).toBe(404)
      }
      const user = await fixture.database
        .selectFrom('user')
        .select('role')
        .where('id', '=', account.userId)
        .executeTakeFirstOrThrow()
      expect(user.role).toBe('admin')
    } finally {
      await fixture.close()
    }
  })
})
