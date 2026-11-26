import { describe, expect, test } from 'bun:test'

import {
  createAccountAuthenticationFixture,
  createVerifiedCredentialAccount,
  withCookie
} from '#cloud-tests/helpers/account-authentication'
import { adminContractClient } from '#cloud-tests/helpers/contract'

const PASSWORD = 'a sufficiently long password'

describe('deployment user listing', () => {
  test('pages through people in the order their accounts were created', async () => {
    const fixture = await createAccountAuthenticationFixture()
    try {
      const emails = ['first@example.com', 'second@example.com', 'third@example.com']
      let cookie = ''
      for (const [index, email] of emails.entries()) {
        const account = await createVerifiedCredentialAccount(fixture, {
          email,
          name: email,
          password: PASSWORD,
          approved: true
        })
        await fixture.database
          .updateTable('user')
          .set({
            createdAt: new Date(Date.UTC(2026, 0, index + 1)),
            role: index === 0 ? 'admin' : 'user'
          })
          .where('id', '=', account.userId)
          .execute()
        if (index === 0) cookie = account.sessionCookie
      }
      // Rewriting the oldest row moves it in storage; the listing must not follow storage order.
      await fixture.database
        .updateTable('user')
        .set({ name: 'First, renamed' })
        .where('email', '=', 'first@example.com')
        .execute()
      const page = async (offset: number) =>
        (
          await adminContractClient(fixture.app, withCookie(cookie).headers).users({
            query: { limit: '2', offset: String(offset) }
          })
        ).users.map((user) => user.email)

      expect([...(await page(0)), ...(await page(2))]).toEqual(emails)
    } finally {
      await fixture.close()
    }
  })
})
