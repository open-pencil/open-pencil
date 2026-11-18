import { describe, expect, test } from 'bun:test'

import { createCloudTokenCache } from '@/app/cloud/tokens'
import { createDeferred, type Deferred } from '@/app/runtime/deferred'

const MINUTE = 60_000

describe('Cloud token cache', () => {
  test('reuses a token until shortly before it expires, signing one at a time', async () => {
    let now = Date.parse('2026-10-21T12:00:00.000Z')
    let signed = 0
    const tokens = createCloudTokenCache(
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
    const tokens = createCloudTokenCache(async () => {
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
    const tokens = createCloudTokenCache(async () => {
      attempts++
      if (attempts === 1) throw new Error('offline')
      return { token: 'token', expiresAt: '2099-01-01T00:00:00.000Z' }
    })
    await expect(tokens.token()).rejects.toThrow('offline')
    expect(await tokens.token()).toBe('token')
  })
  test('signs a new token after a reset, for every client that shares the cache', async () => {
    let signed = 0
    const tokens = createCloudTokenCache(async () => {
      signed++
      return { token: `token-${signed}`, expiresAt: '2099-01-01T00:00:00.000Z' }
    })
    expect(await tokens.token()).toBe('token-1')
    tokens.reset()
    expect(await tokens.token()).toBe('token-2')
  })
  test('never keeps a token signed before a reset', async () => {
    const answers: Deferred<{ token: string; expiresAt: string }>[] = []
    const tokens = createCloudTokenCache(() => {
      const next = createDeferred<{ token: string; expiresAt: string }>()
      answers.push(next)
      return next.promise
    })
    const before = tokens.token()
    tokens.reset()
    const after = tokens.token()
    answers[0]?.resolve({ token: 'old-plan', expiresAt: '2099-01-01T00:00:00.000Z' })
    answers[1]?.resolve({ token: 'new-plan', expiresAt: '2099-01-01T00:00:00.000Z' })

    expect(await before).toBe('old-plan')
    expect(await after).toBe('new-plan')
    expect(await tokens.token()).toBe('new-plan')
  })
})
