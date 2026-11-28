import { describe, expect, test } from 'bun:test'

import { ColorPalette } from '#core/canvas/images/palette'

const MANY = 20_000
const ODD_STRIDE = 7919
const COLOR_BITS = 0xffffff

function scattered(index: number): number {
  return (0xff000000 | ((index * ODD_STRIDE) & COLOR_BITS)) >>> 0
}

describe('ColorPalette', () => {
  test('numbers colours in the order they first arrive and ignores repeats', () => {
    const palette = new ColorPalette()
    for (const color of [0xff0000ff, 0xff00ff00, 0xff0000ff, 0xffff0000, 0xff00ff00]) {
      palette.add(color)
    }
    expect(palette.count).toBe(3)
    expect(Array.from(palette.colors.subarray(0, palette.count))).toEqual([
      0xff0000ff, 0xff00ff00, 0xffff0000
    ])
    expect(palette.indexOf(0xffff0000)).toBe(2)
  })

  test('keeps every index when it grows past its first table', () => {
    const palette = new ColorPalette()
    const first = palette.colors.length
    for (let color = 0; color < MANY; color++) {
      palette.add(scattered(color))
    }
    expect(first).toBeLessThan(MANY)
    expect(palette.count).toBe(MANY)
    for (let color = 0; color < MANY; color++) {
      expect(palette.indexOf(scattered(color))).toBe(color)
    }
  })
})
