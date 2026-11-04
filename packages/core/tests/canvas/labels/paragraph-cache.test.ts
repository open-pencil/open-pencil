import { afterAll, describe, expect, test } from 'bun:test'
import { expectDefined } from '@open-pencil/test-support/assert'
import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { cachedGlyphWidth, measureGlyphWidth, LabelParagraphCache } from '#core/canvas/labels/paragraph-cache'
import { readFileSync } from 'node:fs'
import { repoPath } from '@open-pencil/test-support/paths'

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(8, 8), 'surface'))

afterAll(() => renderer.destroy())

test('a label is measured once per font and text', () => {
  const font = new ck.Font(null, 11)
  try {
    const width = cachedGlyphWidth(renderer, font, '1234')
    expect(width).toBe(measureGlyphWidth(font, '1234'))
    expect(cachedGlyphWidth(renderer, font, '1234')).toBe(width)
    expect(renderer.glyphWidths.get(font)?.size).toBe(1)
  } finally {
    font.delete()
  }
})


describe('label paragraph cache', () => {
  test('shapes labels with Inter and invalidates native paragraphs by font generation', () => {
    const bytes = readFileSync(repoPath('packages/core/assets/InterVariable.ttf'))
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
