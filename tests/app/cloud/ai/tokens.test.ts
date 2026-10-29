import { describe, expect, test } from 'bun:test'

import { createCloudAITokens } from '@/app/cloud/ai/tokens'

const MINUTE = 60_000

describe('Cloud AI tokens', () => {
  test('reuses a token until shortly before it expires, signing one at a time', async () => {
    let now = Date.parse('2026-10-21T12:00:00.000Z')
    let signed = 0
    const tokens = createCloudAITokens(
      async () => {
        signed++
        return { token: `token-${signed}`, expiresAt: new Date(now + 10 * MINUTE).toISOString() }
      },
      () => now
    )

    expect(await Promise.all([tokens.token(), tokens.token()])).toEqual(['token-1', 'token-1'])
    now += 8 * MINUTE
    expect(await tokens.token()).toBe('token-1')
    now += 1.5 * MINUTE
    expect(await tokens.token()).toBe('token-2')
    expect(signed).toBe(2)
  })

  test('drops a refused token, but not a newer one signed meanwhile', async () => {
    let signed = 0
    const tokens = createCloudAITokens(async () => {
      signed++
      return { token: `token-${signed}`, expiresAt: '2099-01-01T00:00:00.000Z' }
    })
    expect(await tokens.token()).toBe('token-1')
    tokens.invalidate('token-1')
    expect(await tokens.token()).toBe('token-2')
    tokens.invalidate('token-1')
    expect(await tokens.token()).toBe('token-2')
  })

  test('signs again after a failed request', async () => {
    let attempts = 0
    const tokens = createCloudAITokens(async () => {
      attempts++
      if (attempts === 1) throw new Error('offline')
      return { token: 'token', expiresAt: '2099-01-01T00:00:00.000Z' }
    })
    await expect(tokens.token()).rejects.toThrow('offline')
    expect(await tokens.token()).toBe('token')
  })
})
