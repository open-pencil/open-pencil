import { describe, expect, test } from 'bun:test'

import { renderTransactionalEmail, type TransactionalEmailContent } from '#cloud/email'

const ACCOUNT_URL = 'https://cloud.example.com/account/sessions'

const notices: TransactionalEmailContent[] = [
  {
    kind: 'email-change-requested',
    payload: { name: 'Ada', newEmail: 'ada@new.example.com', actionURL: ACCOUNT_URL }
  },
  {
    kind: 'new-sign-in',
    payload: {
      name: 'Ada',
      signedInAt: '2026-10-24T12:00:00.000Z',
      ipAddress: '203.0.113.9',
      browser: 'Chrome 141',
      system: 'macOS',
      desktop: false,
      actionURL: ACCOUNT_URL
    }
  },
  ...(['authenticator-on', 'passkey-removed', 'reset-by-administrator'] as const).map(
    (change): TransactionalEmailContent => ({
      kind: 'two-step-changed',
      payload: { name: 'Ada', change, actionURL: ACCOUNT_URL }
    })
  )
]

describe('security notices', () => {
  test.each(notices.map((content) => [content.kind, content] as const))(
    '%s renders a subject and links back to the account',
    async (_kind, content) => {
      const rendered = await renderTransactionalEmail(content)
      expect(rendered.subject.length).toBeGreaterThan(0)
      expect(rendered.html).toContain(ACCOUNT_URL)
      expect(rendered.text).toContain(ACCOUNT_URL)
    }
  )

  test('a new sign-in names the address it came from', async () => {
    const content = notices.find((notice) => notice.kind === 'new-sign-in')
    if (!content) throw new Error('missing notice')
    expect((await renderTransactionalEmail(content)).text).toContain('203.0.113.9')
  })
})
