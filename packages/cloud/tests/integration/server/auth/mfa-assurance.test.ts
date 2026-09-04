import { describe, expect, test } from 'bun:test'

import {
  accountAuthenticationRequest,
  authenticationCookie,
  createAccountAuthenticationFixture,
  createVerifiedCredentialAccount
} from '#cloud-test/helpers/account-authentication'
import { base32 } from '@better-auth/utils/base32'
import { createOTP } from '@better-auth/utils/otp'

import { parseCloudServerConfig } from '@open-pencil/cloud/server'

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
      const setup = (await enabled.json()) as { totpURI: string }
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
      ).toBe(403)
    } finally {
      await fixture.close()
    }
  })
})
