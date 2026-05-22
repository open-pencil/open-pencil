import { afterEach, describe, expect, test, vi } from 'bun:test'

import { FontManager } from '#core/text/fonts'

afterEach(() => {
  vi.restoreAllMocks()
})

async function expectFallbackRetry(method: 'ensureCJKFallback' | 'ensureArabicFallback') {
  const manager = new FontManager()
  const fallbackBuffer = new ArrayBuffer(8)
  let recovered = false

  const loadFontSpy = vi.spyOn(manager, 'loadFont').mockImplementation(async () => {
    return recovered ? fallbackBuffer : null
  })

  const first = await manager[method]()
  expect(first).toEqual([])
  const callsAfterFirst = loadFontSpy.mock.calls.length

  recovered = true
  const second = await manager[method]()
  expect(second.length).toBeGreaterThan(0)
  expect(loadFontSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst)
}

describe('fallback family retry', () => {
  test('retries CJK fallback after an empty resolution', async () => {
    await expectFallbackRetry('ensureCJKFallback')
  })

  test('retries Arabic fallback after an empty resolution', async () => {
    await expectFallbackRetry('ensureArabicFallback')
  })
})
