import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import { initCanvasKit } from '#cli/headless'
import { LabelParagraphCache } from '#core/canvas/labels/paragraph-cache'

import { repoPath } from '#tests/helpers/paths'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
})

describe('label paragraph cache', () => {
  test('shapes labels with Inter and invalidates native paragraphs by font generation', () => {
    const bytes = readFileSync(repoPath('public/Inter-Regular.ttf'))
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    const provider = ck.TypefaceFontProvider.Make()
    provider.registerFont(data, 'Inter')
    const cache = new LabelParagraphCache()
    try {
      const metrics = cache.measure(ck, provider, 'Primitives', 12, 200, ck.BLACK, 1)
      expect(metrics.width).toBeGreaterThan(40)
      expect(metrics.width).toBeLessThan(80)
      expect(metrics.height).toBeGreaterThan(0)
      expect(cache.size()).toBe(1)

      cache.measure(ck, provider, 'Primitives', 12, 200, ck.BLACK, 1)
      expect(cache.size()).toBe(1)
      const semibold = cache.measure(ck, provider, 'Primitives', 12, 200, ck.BLACK, 1, 600)
      expect(semibold).not.toBe(metrics)
      expect(cache.measure(ck, provider, 'Primitives', 12, 200, ck.BLACK, 1, 600)).toBe(semibold)
      expect(cache.size()).toBe(2)
      cache.measure(ck, provider, 'Primitives', 12, 200, ck.BLACK, 2)
      expect(cache.size()).toBe(1)
    } finally {
      cache.clear()
      provider.delete()
    }
    expect(cache.size()).toBe(0)
  })
})
