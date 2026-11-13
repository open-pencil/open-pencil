import { describe, expect, test } from 'bun:test'

import {
  acceptedLocale,
  EMAIL_LOCALES,
  EMAIL_SAMPLE_URL,
  EMAIL_SAMPLES,
  renderEmail,
  renderTransactionalEmail,
  waitlistConfirmation,
  type TransactionalEmailContent
} from '#cloud/email'

describe('localised email', () => {
  test.each([...EMAIL_LOCALES])('every kind renders whole in %s', async (locale) => {
    for (const email of EMAIL_SAMPLES) {
      const rendered = await renderTransactionalEmail(email, locale)
      expect(rendered.html).toContain(`lang="${locale}"`)
      expect(rendered.html).toContain(EMAIL_SAMPLE_URL)
      // A placeholder left in the text is a translation that doesn't match its source.
      expect(`${rendered.subject}\n${rendered.text}`).not.toMatch(/\{\w+\}/)
    }
  })

  test('German email is German, with its dates written the German way', async () => {
    const rendered = await renderTransactionalEmail(
      EMAIL_SAMPLES[0] as TransactionalEmailContent,
      'de'
    )
    expect(rendered.html).toContain('dir="ltr"')
    expect(rendered.text).toContain('Homepage')
    expect(rendered.text).toContain('20. November 2026')
    expect(rendered.text).not.toContain('invited you')
  })

  test('Arabic email reads right to left, and keeps names in their own order', async () => {
    const rendered = await renderTransactionalEmail(
      EMAIL_SAMPLES[0] as TransactionalEmailContent,
      'ar'
    )
    expect(rendered.html).toContain('dir="rtl"')
    expect(rendered.subject).toContain('⁨Homepage⁩')
  })

  test('the waitlist link sits inside its sentence', async () => {
    const rendered = await renderEmail(
      waitlistConfirmation,
      { confirmURL: EMAIL_SAMPLE_URL, leaveURL: 'https://openpencil.dev/leave' },
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
