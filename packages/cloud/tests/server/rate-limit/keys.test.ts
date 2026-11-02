import { describe, expect, test } from 'bun:test'

import { trustedClientIP } from '#cloud/server/rate-limit/keys'
import { Hono } from 'hono'

async function clientIP(headers: Record<string, string>, trustedHeaders: string[]) {
  const app = new Hono().get('/', (context) =>
    context.text(trustedClientIP(context, { trustedHeaders }) ?? 'none')
  )
  return (await app.request('/', { headers })).text()
}

describe('trusted client address', () => {
  test('takes the entry the trusted proxy appended, not what the client sent', async () => {
    expect(
      await clientIP({ 'x-forwarded-for': 'spoofed-1, 203.0.113.7' }, ['x-forwarded-for'])
    ).toBe('203.0.113.7')
    expect(await clientIP({ 'x-forwarded-for': '203.0.113.7' }, ['x-forwarded-for'])).toBe(
      '203.0.113.7'
    )
  })

  test('skips empty entries and headers that are not trusted', async () => {
    expect(await clientIP({ 'x-forwarded-for': '203.0.113.7, ' }, ['x-forwarded-for'])).toBe(
      '203.0.113.7'
    )
    expect(await clientIP({ 'x-forwarded-for': '203.0.113.7' }, ['x-real-ip'])).toBe('none')
    expect(
      await clientIP({ 'x-real-ip': '198.51.100.2', 'x-forwarded-for': 'a, b' }, [
        'x-real-ip',
        'x-forwarded-for'
      ])
    ).toBe('198.51.100.2')
  })
})
