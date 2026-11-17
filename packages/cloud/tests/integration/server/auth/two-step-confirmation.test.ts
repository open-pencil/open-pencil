import { describe, expect, test } from 'bun:test'

import {
  accountAuthenticationRequest,
  createAccountAuthenticationFixture,
  createVerifiedCredentialAccount,
  withCookie
} from '#cloud-tests/helpers/account-authentication'
import { responseJSON } from '#cloud-tests/helpers/response'
import { cloudAccountStatusResponseSchema } from '#cloud/contract'
import { parseCloudServerConfig } from '#cloud/server'
import { base32 } from '@better-auth/utils/base32'
import { createOTP } from '@better-auth/utils/otp'
import * as v from 'valibot'

const config = parseCloudServerConfig({
  deployment: 'self-hosted',
  publicURL: 'https://cloud.example.com',
  databaseURL: 'postgresql://test:test@localhost/test',
  authSecret: 'two-step-confirmation-test-secret-at-least-32-characters',
  enrollmentMode: 'approval',
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

const PASSWORD = 'a sufficiently long password'

/** The cookie a response signs the session in with. */
function sessionCookie(response: { headers: Headers }): string {
  const match = response.headers
    .get('set-cookie')
    ?.match(/(?:^|,\s*)([^;,]*better-auth\.session_token=[^;]+)/)
  if (!match?.[1]) throw new Error('Expected a session cookie')
  return match[1]
}

/** An account with an authenticator, signed in with a session that proved it. */
async function accountWithAuthenticator(
  fixture: Awaited<ReturnType<typeof createAccountAuthenticationFixture>>
) {
  const account = await createVerifiedCredentialAccount(fixture, {
    email: 'person@example.com',
    name: 'Person',
    password: PASSWORD,
    approved: true
  })
  const enabled = await fixture.client.api.account.mfa.totp.enable.$post(
    { json: { password: PASSWORD } },
    withCookie(account.sessionCookie)
  )
  const { totpURI } = await responseJSON(enabled, v.object({ totpURI: v.string() }))
  const secret = new URL(totpURI).searchParams.get('secret')
  if (!secret) throw new Error('Expected a TOTP secret')
  const code = () => createOTP(new TextDecoder().decode(base32.decode(secret))).totp()
  // The first code turns the authenticator on, in a new session that proved it.
  const turnedOn = await fixture.client.api.account.mfa.totp.verify.$post(
    { json: { code: await code() } },
    withCookie(account.sessionCookie)
  )
  expect(turnedOn.status).toBe(200)
  return { ...account, confirmed: withCookie(sessionCookie(turnedOn)), code }
}

/**
 * A session made without a second step, as signing in through Google makes one, read through its
 * token as a desktop app's is.
 */
async function sessionWithoutSecondStep(
  fixture: Awaited<ReturnType<typeof createAccountAuthenticationFixture>>,
  userId: string
) {
  const token = crypto.randomUUID().replaceAll('-', '')
  const now = new Date()
  await fixture.database
    .insertInto('session')
    .values({
      id: crypto.randomUUID(),
      userId,
      token,
      expiresAt: new Date(now.getTime() + 60 * 60_000),
      createdAt: now,
      updatedAt: now
    })
    .execute()
  return { headers: { Authorization: `Bearer ${token}` } }
}

async function accountState(
  fixture: Awaited<ReturnType<typeof createAccountAuthenticationFixture>>,
  signedIn: { headers: Record<string, string> }
) {
  const response = await fixture.client.api.account.status.$get(undefined, signedIn)
  return (await responseJSON(response, cloudAccountStatusResponseSchema)).state
}

describe('two-step confirmation', () => {
  test('holds a session that never proved its second step until it does', async () => {
    const fixture = await createAccountAuthenticationFixture({ config })
    try {
      const account = await accountWithAuthenticator(fixture)
      const held = await sessionWithoutSecondStep(fixture, account.userId)
      expect(await accountState(fixture, held)).toBe('two-step')
      expect(await accountState(fixture, account.confirmed)).toBe('active')

      // Held, it reaches nothing but proving it.
      const workspaces = await fixture.client.api.workspaces.$get(undefined, held)
      expect(workspaces.status).toBe(401)
      const mfa = await fixture.client.api.account.mfa.$get(undefined, held)
      expect(mfa.status).toBe(200)

      const proved = await fixture.client.api.account.mfa.totp.verify.$post(
        { json: { code: await account.code() } },
        held
      )
      expect(proved.status).toBe(200)
      // Proving it lets the same session use the server.
      expect(await accountState(fixture, held)).toBe('active')
      expect((await fixture.client.api.workspaces.$get(undefined, held)).status).toBe(200)
    } finally {
      await fixture.close()
    }
  })

  test('lets only a session that proved it approve a desktop sign-in, which then counts as proved', async () => {
    const fixture = await createAccountAuthenticationFixture({ config })
    try {
      const account = await accountWithAuthenticator(fixture)
      const held = await sessionWithoutSecondStep(fixture, account.userId)
      const clientId = 'openpencil-desktop:test-connection'
      const issued = await fixture.app.fetch(
        accountAuthenticationRequest('/api/auth/device/code', {
          client_id: clientId,
          scope: 'openid profile'
        })
      )
      const authorization = await responseJSON(
        issued,
        v.object({ user_code: v.string(), device_code: v.string() })
      )
      const approve = (signedIn: { headers: Record<string, string> }) =>
        fixture.app.fetch(
          accountAuthenticationRequest(
            '/api/auth/device/approve',
            { userCode: authorization.user_code },
            undefined,
            signedIn
          )
        )
      // The device page reads the code before anyone approves it.
      const inspected = await fixture.app.fetch(
        accountAuthenticationRequest(
          `/api/auth/device?user_code=${authorization.user_code}`,
          undefined,
          undefined,
          account.confirmed
        )
      )
      expect(inspected.status).toBe(200)
      expect((await approve(held)).status).toBe(401)
      expect((await approve(account.confirmed)).status).toBe(200)

      const token = await fixture.app.fetch(
        accountAuthenticationRequest('/api/auth/device/token', {
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: authorization.device_code,
          client_id: clientId
        })
      )
      const { access_token } = await responseJSON(token, v.object({ access_token: v.string() }))
      expect(
        await accountState(fixture, { headers: { Authorization: `Bearer ${access_token}` } })
      ).toBe('active')
    } finally {
      await fixture.close()
    }
  })

  test('counts a code checked on the two-step endpoint itself for the session that checked it', async () => {
    const fixture = await createAccountAuthenticationFixture({ config })
    try {
      const account = await accountWithAuthenticator(fixture)
      const held = await sessionWithoutSecondStep(fixture, account.userId)
      const verified = await fixture.app.fetch(
        accountAuthenticationRequest(
          '/api/auth/two-factor/verify-totp',
          { code: await account.code() },
          undefined,
          held
        )
      )
      expect(verified.status).toBe(200)
      expect(await accountState(fixture, held)).toBe('active')
    } finally {
      await fixture.close()
    }
  })

  test('leaves an account without a second step as it was', async () => {
    const fixture = await createAccountAuthenticationFixture({ config })
    try {
      const account = await createVerifiedCredentialAccount(fixture, {
        email: 'plain@example.com',
        name: 'Plain',
        password: PASSWORD,
        approved: true
      })
      expect(await accountState(fixture, withCookie(account.sessionCookie))).toBe('active')
    } finally {
      await fixture.close()
    }
  })
})
