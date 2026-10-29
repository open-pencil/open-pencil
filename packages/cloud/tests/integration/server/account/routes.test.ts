import { describe, expect, test } from 'bun:test'

import {
  accountAuthenticationConfig,
  accountAuthenticationRequest,
  authenticationCookie,
  createAccountAuthenticationFixture,
  createVerifiedCredentialAccount
} from '#cloud-tests/helpers/account-authentication'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  accountSecurityErrorResponseSchema,
  cloudAccountSessionsResponseSchema,
  cloudAccountStatusResponseSchema,
  cloudProfileResponseSchema,
  cloudSignInsResponseSchema
} from '#cloud/contract'
import { base32 } from '@better-auth/utils/base32'
import { createOTP } from '@better-auth/utils/otp'
import * as v from 'valibot'

const PASSWORD = 'a sufficiently long password'
const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const config = { ...accountAuthenticationConfig, authTrustedIPHeaders: ['x-forwarded-for'] }

async function signIn(
  fixture: Awaited<ReturnType<typeof createAccountAuthenticationFixture>>,
  email: string,
  headers: Record<string, string> = {}
): Promise<string> {
  const response = await fixture.app.fetch(
    accountAuthenticationRequest(
      '/api/auth/sign-in/email',
      { email, password: PASSWORD },
      undefined,
      { headers }
    )
  )
  return authenticationCookie(response)
}

describe('account profile', () => {
  test('reads and renames the signed-in person', async () => {
    const fixture = await createAccountAuthenticationFixture()
    try {
      const account = await createVerifiedCredentialAccount(fixture, {
        email: 'profile@example.com',
        name: 'Profile Person',
        password: PASSWORD,
        approved: true
      })
      const read = async () =>
        (
          await responseJSON(
            await fixture.app.fetch(
              accountAuthenticationRequest('/api/account/profile', undefined, account.sessionCookie)
            ),
            cloudProfileResponseSchema
          )
        ).profile
      expect(await read()).toMatchObject({
        id: account.userId,
        name: 'Profile Person',
        email: 'profile@example.com',
        emailChangeAvailable: true
      })

      const renamed = await fixture.app.fetch(
        accountAuthenticationRequest(
          '/api/account/profile',
          { name: '  Renamed Person  ' },
          account.sessionCookie
        )
      )
      expect(renamed.status).toBe(200)
      expect((await read()).name).toBe('Renamed Person')
      const blank = await fixture.app.fetch(
        accountAuthenticationRequest('/api/account/profile', { name: ' ' }, account.sessionCookie)
      )
      expect(blank.status).toBe(400)
      const signedOut = await fixture.app.fetch(
        accountAuthenticationRequest('/api/account/profile')
      )
      expect(signedOut.status).toBe(401)
    } finally {
      await fixture.close()
    }
  })

  test('changes the email once the new address confirms it, keeping the approval', async () => {
    const notices: Array<{ email: string; newEmail: string }> = []
    const verifications: Array<{ email: string; url: string; purpose?: string }> = []
    const fixture = await createAccountAuthenticationFixture({
      email: {
        async sendEmailChangeRequested(input) {
          notices.push(input)
        },
        async sendVerification(input) {
          verifications.push(input)
        }
      }
    })
    try {
      const account = await createVerifiedCredentialAccount(fixture, {
        email: 'old@example.com',
        name: 'Moving Person',
        password: PASSWORD,
        approved: true
      })
      const unchanged = await fixture.app.fetch(
        accountAuthenticationRequest(
          '/api/account/profile/email',
          { newEmail: 'OLD@example.com', callbackURL: `${config.publicURL}/account` },
          account.sessionCookie
        )
      )
      expect(unchanged.status).toBe(400)
      expect((await responseJSON(unchanged, accountSecurityErrorResponseSchema)).error.code).toBe(
        'email_unchanged'
      )

      const requested = await fixture.app.fetch(
        accountAuthenticationRequest(
          '/api/account/profile/email',
          { newEmail: 'New@example.com', callbackURL: `${config.publicURL}/account` },
          account.sessionCookie
        )
      )
      expect(requested.status).toBe(200)
      expect(notices).toEqual([
        expect.objectContaining({ email: 'old@example.com', newEmail: 'new@example.com' })
      ])
      const verification = verifications.at(-1)
      expect(verification).toMatchObject({ email: 'new@example.com', purpose: 'change' })
      const user = () =>
        fixture.database
          .selectFrom('user')
          .select('email')
          .where('id', '=', account.userId)
          .executeTakeFirstOrThrow()
      expect((await user()).email).toBe('old@example.com')

      await fixture.app.fetch(
        new Request(verification?.url ?? '', { headers: { Cookie: account.sessionCookie } })
      )
      expect((await user()).email).toBe('new@example.com')
      const enrollment = await fixture.database
        .selectFrom('enrollment')
        .select(['emailNormalized', 'status'])
        .where('approvedUserId', '=', account.userId)
        .executeTakeFirstOrThrow()
      expect(enrollment).toEqual({ emailNormalized: 'new@example.com', status: 'approved' })
      const status = await responseJSON(
        await fixture.app.fetch(
          accountAuthenticationRequest(
            '/api/account/status',
            undefined,
            await signIn(fixture, 'new@example.com')
          )
        ),
        cloudAccountStatusResponseSchema
      )
      expect(status.state).toBe('active')
    } finally {
      await fixture.close()
    }
  })

  test('asks a session that signed in a while ago to sign in again before changing email', async () => {
    const fixture = await createAccountAuthenticationFixture()
    try {
      const account = await createVerifiedCredentialAccount(fixture, {
        email: 'stale@example.com',
        name: 'Stale Person',
        password: PASSWORD,
        approved: true
      })
      await fixture.database
        .updateTable('session')
        .set({ createdAt: new Date(Date.now() - 60 * 60_000) })
        .where('userId', '=', account.userId)
        .execute()
      const response = await fixture.app.fetch(
        accountAuthenticationRequest(
          '/api/account/profile/email',
          { newEmail: 'fresh@example.com', callbackURL: `${config.publicURL}/account` },
          account.sessionCookie
        )
      )
      expect(response.status).toBe(403)
      expect((await responseJSON(response, accountSecurityErrorResponseSchema)).error.code).toBe(
        'session_not_fresh'
      )
    } finally {
      await fixture.close()
    }
  })
})

describe('account sessions and sign-ins', () => {
  test('lists sessions with how they signed in and ends the other ones', async () => {
    const fixture = await createAccountAuthenticationFixture({ config })
    try {
      const account = await createVerifiedCredentialAccount(fixture, {
        email: 'sessions@example.com',
        name: 'Session Person',
        password: PASSWORD,
        approved: true
      })
      const other = await signIn(fixture, 'sessions@example.com', {
        'X-Forwarded-For': '203.0.113.9',
        'User-Agent': CHROME
      })
      const list = async (cookie: string) =>
        (
          await responseJSON(
            await fixture.app.fetch(
              accountAuthenticationRequest('/api/account/sessions', undefined, cookie)
            ),
            cloudAccountSessionsResponseSchema
          )
        ).sessions
      const sessions = await list(account.sessionCookie)
      expect(sessions).toHaveLength(2)
      const current = sessions.find((session) => session.current)
      const elsewhere = sessions.find((session) => !session.current)
      expect(current?.method).toBe('password')
      expect(elsewhere).toMatchObject({
        method: 'password',
        ipAddress: '203.0.113.9',
        browser: 'Chrome 141',
        system: 'macOS'
      })

      const ownSession = await fixture.app.fetch(
        accountAuthenticationRequest(
          '/api/account/sessions/revoke',
          { sessionId: current?.id },
          account.sessionCookie
        )
      )
      expect(ownSession.status).toBe(400)
      expect((await responseJSON(ownSession, accountSecurityErrorResponseSchema)).error.code).toBe(
        'current_session'
      )

      const revoked = await fixture.app.fetch(
        accountAuthenticationRequest(
          '/api/account/sessions/revoke',
          { sessionId: elsewhere?.id },
          account.sessionCookie
        )
      )
      expect(revoked.status).toBe(200)
      expect(await list(account.sessionCookie)).toHaveLength(1)
      const ended = await fixture.app.fetch(
        accountAuthenticationRequest('/api/account/sessions', undefined, other)
      )
      expect(ended.status).toBe(401)

      await signIn(fixture, 'sessions@example.com')
      expect(await list(account.sessionCookie)).toHaveLength(2)
      await fixture.app.fetch(
        accountAuthenticationRequest(
          '/api/account/sessions/revoke-others',
          {},
          account.sessionCookie
        )
      )
      expect(await list(account.sessionCookie)).toEqual([
        expect.objectContaining({ current: true })
      ])
    } finally {
      await fixture.close()
    }
  })

  test('records sign-ins and emails one from an address the account never used', async () => {
    const alerts: Array<{ ipAddress: string | null; browser: string | null }> = []
    const fixture = await createAccountAuthenticationFixture({
      config,
      email: {
        async sendNewSignIn(input) {
          alerts.push(input)
        }
      }
    })
    try {
      const account = await createVerifiedCredentialAccount(fixture, {
        email: 'alerts@example.com',
        name: 'Alert Person',
        password: PASSWORD,
        approved: true
      })
      // The account's first sign-in is the one that made it, so nobody is told about it.
      expect(alerts).toHaveLength(0)
      const from = { 'X-Forwarded-For': '198.51.100.4', 'User-Agent': CHROME }
      await signIn(fixture, 'alerts@example.com', from)
      expect(alerts).toEqual([
        expect.objectContaining({ ipAddress: '198.51.100.4', browser: 'Chrome 141' })
      ])
      await signIn(fixture, 'alerts@example.com', from)
      expect(alerts).toHaveLength(1)

      const signIns = (
        await responseJSON(
          await fixture.app.fetch(
            accountAuthenticationRequest('/api/account/sign-ins', undefined, account.sessionCookie)
          ),
          cloudSignInsResponseSchema
        )
      ).signIns
      expect(signIns).toHaveLength(3)
      expect(signIns.every((entry) => entry.method === 'password')).toBe(true)
      expect(signIns[0]?.ipAddress).toBe('198.51.100.4')
    } finally {
      await fixture.close()
    }
  })

  test('records a two-step sign-in once its second step is done', async () => {
    const changes: string[] = []
    const fixture = await createAccountAuthenticationFixture({
      config: { ...config, totpEnabled: true, recoveryCodesEnabled: true },
      email: {
        async sendTwoStepChanged(input) {
          changes.push(input.change)
        }
      }
    })
    try {
      const account = await createVerifiedCredentialAccount(fixture, {
        email: 'steps@example.com',
        name: 'Two Steps',
        password: PASSWORD,
        approved: true
      })
      const setup = await responseJSON(
        await fixture.app.fetch(
          accountAuthenticationRequest(
            '/api/account/mfa/totp/enable',
            { password: PASSWORD },
            account.sessionCookie
          )
        ),
        v.object({ totpURI: v.string() })
      )
      const secret = new TextDecoder().decode(
        base32.decode(new URL(setup.totpURI).searchParams.get('secret') ?? '')
      )
      const otp = createOTP(secret)
      await fixture.app.fetch(
        accountAuthenticationRequest(
          '/api/account/mfa/totp/verify',
          { code: await otp.totp() },
          account.sessionCookie
        )
      )
      expect(changes).toEqual(['authenticator-on'])
      const recorded = async () =>
        (
          await fixture.database
            .selectFrom('signIn')
            .select('method')
            .where('userId', '=', account.userId)
            .orderBy('createdAt')
            .execute()
        ).map((row) => row.method)
      const before = await recorded()

      const pending = await fixture.app.fetch(
        accountAuthenticationRequest('/api/auth/sign-in/email', {
          email: 'steps@example.com',
          password: PASSWORD
        })
      )
      expect(await recorded()).toEqual(before)
      const challenge = pending.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';', 1)[0])
        .find((cookie) => cookie?.includes('two_factor'))
      await fixture.app.fetch(
        accountAuthenticationRequest(
          '/api/auth/two-factor/verify-totp',
          { code: await otp.totp() },
          challenge
        )
      )
      expect(await recorded()).toEqual([...before, 'two-step'])
    } finally {
      await fixture.close()
    }
  })
})
