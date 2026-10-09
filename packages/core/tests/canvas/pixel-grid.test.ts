import { describe, expect, test } from 'bun:test'

import { pixelGridVisible } from '#core/canvas/overlays/pixel-grid'

// Figma desktop 126 shows the grid once a document pixel covers 8 device pixels.
describe('pixel grid', () => {
  test('shows from 800% at 1× density and from 400% at 2×', () => {
    expect(pixelGridVisible(7.9, 1)).toBe(false)
    expect(pixelGridVisible(8, 1)).toBe(true)
    expect(pixelGridVisible(3.9, 2)).toBe(false)
    expect(pixelGridVisible(4, 2)).toBe(true)
  })
})
