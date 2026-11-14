import { expect, test } from 'bun:test'

import { securityTxt } from '#docs-config/security-txt'

test('security.txt sends reports to GitHub Security Advisories, and expires within a year', () => {
  const now = new Date('2026-11-14T00:00:00.000Z')
  const fields = new Map(
    securityTxt('https://openpencil.dev', now)
      .trim()
      .split('\n')
      .map((line) => {
        const [name = '', ...value] = line.split(': ')
        return [name, value.join(': ')] as const
      })
  )
  expect(fields.get('Contact')).toBe(
    'https://github.com/open-pencil/open-pencil/security/advisories/new'
  )
  expect(fields.get('Canonical')).toBe('https://openpencil.dev/.well-known/security.txt')
  const expires = new Date(fields.get('Expires') ?? '')
  expect(expires.getTime()).toBeGreaterThan(now.getTime())
  expect(expires.getTime() - now.getTime()).toBeLessThan(365 * 24 * 60 * 60 * 1000)
})
