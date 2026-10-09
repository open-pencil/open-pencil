import { describe, expect, test } from 'bun:test'

import { pixelGridLines, pixelGridVisible } from '#core/canvas/overlays/pixel-grid'

// Figma desktop 126 shows the grid once a document pixel covers 8 device pixels.
describe('pixel grid', () => {
  test('shows from 800% at 1× density and from 400% at 2×', () => {
    expect(pixelGridVisible(7.9, 1)).toBe(false)
    expect(pixelGridVisible(8, 1)).toBe(true)
    expect(pixelGridVisible(3.9, 2)).toBe(false)
    expect(pixelGridVisible(4, 2)).toBe(true)
  })

  test('draws a line at every document pixel on a whole device pixel', () => {
    expect(pixelGridLines(-3, 8, 20, 1)).toEqual([5, 13])
    // At 2× a line can fall on a half CSS pixel, which is a whole device pixel.
    expect(pixelGridLines(0.3, 4, 9, 2)).toEqual([0.5, 4.5, 8.5])
    expect(pixelGridLines(0, 4, 100, 1)).toEqual([])
  })
})
