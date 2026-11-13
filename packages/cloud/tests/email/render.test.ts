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

describe('the storage-limit email', () => {
  const PLAN_URL = 'https://cloud.example.com/account/plan'
  const content = (upgradable: boolean): TransactionalEmailContent => ({
    kind: 'storage-limit-reached',
    payload: {
      name: 'Ada',
      usedBytes: 310 * 1024 ** 2,
      limitBytes: 300 * 1024 ** 2,
      upgradable,
      actionURL: PLAN_URL
    }
  })

  test('says how much the account holds against its plan, and links to the plan', async () => {
    const rendered = await renderTransactionalEmail(content(true))
    expect(rendered.text).toContain('310 MB')
    expect(rendered.text).toContain('300 MB')
    expect(rendered.text).toContain('Get more storage')
    expect(rendered.html).toContain(PLAN_URL)
  })

  test('offers only freeing space where the server sells no plans', async () => {
    const rendered = await renderTransactionalEmail(content(false))
    expect(rendered.text).not.toContain('Get more storage')
    expect(rendered.text).toContain('empty the trash')
  })
})
