import { describe, expect, test } from 'bun:test'

import { parseWebAddress } from '@/app/document/io/url/open'

describe('parseWebAddress', () => {
  test('takes an address without a scheme as https, a port included', () => {
    expect(parseWebAddress('example.com')?.href).toBe('https://example.com/')
    expect(parseWebAddress(' example.com:8443/page ')?.href).toBe('https://example.com:8443/page')
    expect(parseWebAddress('localhost:3000')?.href).toBe('https://localhost:3000/')
  })

  test('keeps an http or https address as written', () => {
    expect(parseWebAddress('http://example.com:8080/a')?.href).toBe('http://example.com:8080/a')
  })

  test('refuses other schemes and text that is no address', () => {
    expect(parseWebAddress('mailto:someone@example.com')).toBeNull()
    expect(parseWebAddress('file:///etc/hosts')).toBeNull()
    expect(parseWebAddress('   ')).toBeNull()
  })
})
