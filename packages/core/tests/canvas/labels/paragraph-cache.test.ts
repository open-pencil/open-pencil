import { afterAll, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'

import { cachedGlyphWidth, measureGlyphWidth } from '#core/canvas/labels/paragraph-cache'

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
