import { describe, test, expect } from 'bun:test'

import { fontManager } from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

describe('fetchBundledFont', () => {
  test('loads Inter-Regular.ttf from assets in headless', async () => {
    const buffer = await fontManager.fetchBundledFont('/Inter-Regular.ttf')
    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(expectDefined(buffer, 'Inter font buffer').byteLength).toBeGreaterThan(100_000)
  })

  test('loads Inter-Bold.ttf from assets in headless', async () => {
    const buffer = await fontManager.fetchBundledFont('/Inter-Bold.ttf')
    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(expectDefined(buffer, 'Inter bold font buffer').byteLength).toBeGreaterThan(100_000)
  })

  test('returns valid TTF data', async () => {
    const buffer = await fontManager.fetchBundledFont('/Inter-Regular.ttf')
    const view = new DataView(expectDefined(buffer, 'Inter font buffer'))
    expect(view.getUint32(0)).toBe(0x00010000)
  })

  test('throws for nonexistent font', async () => {
    expect(fontManager.fetchBundledFont('/Nonexistent-Font.ttf')).rejects.toThrow()
  })
})
