import { describe, expect, test } from 'bun:test'

import { linkFromInput } from '#core/text/links'

describe('a typed link', () => {
  test('keeps web, mail, and phone links as typed', () => {
    expect(linkFromInput(' https://openpencil.dev/docs ')).toEqual({
      type: 'URL',
      value: 'https://openpencil.dev/docs'
    })
    expect(linkFromInput('mailto:hi@openpencil.dev')?.value).toBe('mailto:hi@openpencil.dev')
    expect(linkFromInput('tel:+15550100')?.value).toBe('tel:+15550100')
  })

  test('adds the scheme a bare host or address leaves out', () => {
    expect(linkFromInput('openpencil.dev/docs?a=1')?.value).toBe('https://openpencil.dev/docs?a=1')
    expect(linkFromInput('hi@openpencil.dev')?.value).toBe('mailto:hi@openpencil.dev')
  })

  test('removes the link when empty, and rejects what is not a link', () => {
    expect(linkFromInput('   ')).toBeNull()
    expect(linkFromInput('not a link')).toBeUndefined()
    expect(linkFromInput('data:text/html,hi')).toBeUndefined()
    expect(linkFromInput('ftp://openpencil.dev')).toBeUndefined()
  })
})
