import { describe, expect, test } from 'bun:test'

import {
  accountAuthenticationRequest,
  createAccountAuthenticationFixture,
  createVerifiedCredentialAccount
} from '#cloud-test/helpers/account-authentication'

describe('account password changes', () => {
  test('changes the password, revokes other sessions, and sends a notification', async () => {
    let passwordChanged = false
    const fixture = await createAccountAuthenticationFixture({
      onPasswordChanged() {
        passwordChanged = true
      }
    })
    try {
      const account = await createVerifiedCredentialAccount(fixture, {
        email: 'password@example.com',
        name: 'Password Person',
        password: 'the original long password',
        approved: true
      })
      await fixture.app.fetch(
        accountAuthenticationRequest('/api/auth/sign-in/email', {
          email: 'password@example.com',
          password: 'the original long password'
        })
      )
      const before = await fixture.database
        .selectFrom('session')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('userId', '=', account.userId)
        .executeTakeFirstOrThrow()
      expect(Number(before.count)).toBeGreaterThan(1)

      const response = await fixture.app.fetch(
        accountAuthenticationRequest(
          '/api/account/authentication/change-password',
          {
            currentPassword: 'the original long password',
            newPassword: 'the replacement long password'
          },
          account.sessionCookie
        )
      )
      expect(response.status).toBe(200)
      expect(passwordChanged).toBe(true)
      const after = await fixture.database
        .selectFrom('session')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('userId', '=', account.userId)
        .executeTakeFirstOrThrow()
      expect(Number(after.count)).toBe(1)
      expect(
        await fixture.app.fetch(
          accountAuthenticationRequest('/api/account/status', undefined, account.sessionCookie)
        )
      ).toHaveProperty('status', 200)
    } finally {
      await fixture.close()
    }
  })
})
