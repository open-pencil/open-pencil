import { describe, expect, test } from 'bun:test'

import { CLOUD_LOCALES } from '#cloud/contract'
import {
  acceptedLocale,
  renderEmail,
  renderTransactionalEmail,
  waitlistConfirmation,
  type TransactionalEmailContent
} from '#cloud/email'

const URL = 'https://cloud.example.com/next'

/** One email of every kind, with every optional part filled. */
const EMAILS: TransactionalEmailContent[] = [
  {
    kind: 'document-invitation',
    payload: {
      inviterName: 'Ada',
      documentName: 'Homepage',
      permission: 'edit',
      expiresAt: '2026-11-20T10:00:00.000Z',
      acceptanceURL: URL
    }
  },
  {
    kind: 'workspace-invitation',
    payload: {
      inviterName: null,
      workspaceName: 'Studio',
      role: 'viewer',
      expiresAt: '2026-11-20T10:00:00.000Z',
      acceptanceURL: URL
    }
  },
  ...(
    [
      'enrollment-requested',
      'enrollment-approved',
      'enrollment-rejected',
      'enrollment-revoked'
    ] as const
  ).map((kind): TransactionalEmailContent => ({ kind, payload: { name: 'Ada', actionURL: URL } })),
  {
    kind: 'admin-enrollment-notification',
    payload: {
      requesterEmail: 'ada@example.com',
      requesterName: 'Ada',
      reason: 'Design',
      actionURL: URL
    }
  },
  {
    kind: 'email-verification',
    payload: { name: 'Ada', actionURL: URL, purpose: 'change' }
  },
  { kind: 'password-reset', payload: { name: 'Ada', actionURL: URL } },
  { kind: 'password-changed', payload: { name: 'Ada', actionURL: URL } },
  {
    kind: 'email-change-requested',
    payload: { name: 'Ada', newEmail: 'ada@new.example.com', actionURL: URL }
  },
  {
    kind: 'new-sign-in',
    payload: {
      name: 'Ada',
      signedInAt: '2026-11-13T10:00:00.000Z',
      ipAddress: '203.0.113.9',
      browser: 'Firefox',
      system: 'Linux',
      desktop: false,
      actionURL: URL
    }
  },
  {
    kind: 'two-step-changed',
    payload: { name: 'Ada', change: 'passkey-added', actionURL: URL }
  },
  {
    kind: 'document-report',
    payload: {
      documentName: 'Homepage',
      reason: 'copyright',
      description: 'Copied',
      actionURL: URL
    }
  },
  {
    kind: 'storage-limit-reached',
    payload: {
      name: 'Ada',
      usedBytes: 310 * 1024 ** 2,
      limitBytes: 300 * 1024 ** 2,
      upgradable: true,
      actionURL: URL
    }
  }
]

describe('localised email', () => {
  test.each([...CLOUD_LOCALES])('every kind renders whole in %s', async (locale) => {
    for (const email of EMAILS) {
      const rendered = await renderTransactionalEmail(email, locale)
      expect(rendered.html).toContain(`lang="${locale}"`)
      expect(rendered.html).toContain(URL)
      // A placeholder left in the text is a translation that doesn't match its source.
      expect(`${rendered.subject}\n${rendered.text}`).not.toMatch(/\{\w+\}/)
    }
  })

  test('German email is German, with its dates written the German way', async () => {
    const rendered = await renderTransactionalEmail(EMAILS[0] as TransactionalEmailContent, 'de')
    expect(rendered.html).toContain('dir="ltr"')
    expect(rendered.text).toContain('Homepage')
    expect(rendered.text).toContain('20. November 2026')
    expect(rendered.text).not.toContain('invited you')
  })

  test('Arabic email reads right to left, and keeps names in their own order', async () => {
    const rendered = await renderTransactionalEmail(EMAILS[0] as TransactionalEmailContent, 'ar')
    expect(rendered.html).toContain('dir="rtl"')
    expect(rendered.subject).toContain('⁨Homepage⁩')
  })

  test('the waitlist link sits inside its sentence', async () => {
    const rendered = await renderEmail(
      waitlistConfirmation,
      { confirmURL: URL, leaveURL: 'https://openpencil.dev/leave' },
      'fr'
    )
    expect(rendered.html).toContain('href="https://openpencil.dev/leave"')
    expect(rendered.text).not.toContain('{link}')
  })
})

describe('acceptedLocale', () => {
  test('takes the first language Cloud writes in, by tag or by script', () => {
    expect(acceptedLocale('nl-NL, de-AT;q=0.8, en;q=0.5')).toBe('de')
    expect(acceptedLocale('zh-TW, zh-SG;q=0.9')).toBe('zh-CN')
    expect(acceptedLocale('pt-BR')).toBe('pt-BR')
    expect(acceptedLocale('fr;q=0, ja')).toBe('ja')
  })

  test('names none for a header without one', () => {
    expect(acceptedLocale(undefined)).toBeNull()
    expect(acceptedLocale('nl, sv')).toBeNull()
  })
})
