import { describe, expect, test } from 'bun:test'

import {
  MAX_TILE_LEVEL,
  MIN_TILE_LEVEL,
  TILE_DEVICE_SIZE,
  tileKeyString,
  tileKeysForWorldBounds,
  tileLevel,
  tileWorldBounds,
  tileWorldSize
} from '#core/canvas/renderer/tiles'

describe('tile geometry', () => {
  test('quantizes scale upward in geometric steps and keeps fixed device-pixel targets', () => {
    expect(tileLevel(1)).toBe(1)
    expect(tileLevel(1.01)).toBeCloseTo(2 ** 0.25, 12)
    expect(tileLevel(1.26)).toBeCloseTo(2 ** 0.5, 12)
    expect(tileLevel(2)).toBe(2)
    expect(tileLevel(400)).toBeCloseTo(2 ** 8.75, 9)
    expect(tileWorldSize(2)).toBe(TILE_DEVICE_SIZE / 2)
  })

  test('crosses few levels between 1 % and 20,000 %, each at most a step finer than its scale', () => {
    const levels = new Set<number>()
    for (let scale = 0.02; scale <= 400; scale *= 1.01) {
      const level = tileLevel(scale)
      expect(level).toBeGreaterThanOrEqual(scale)
      expect(level / scale).toBeLessThan(2 ** 0.25 + 1e-9)
      levels.add(level)
    }
    expect(levels.size).toBeLessThan(70)
    expect(tileLevel(1e-9)).toBe(MIN_TILE_LEVEL)
    expect(tileLevel(1e9)).toBe(MAX_TILE_LEVEL)
  })

  test('adds lower levels to bound visible tile counts at very low zoom', () => {
    const level = tileLevel(0.04)
    const keys = tileKeysForWorldBounds('page', level, {
      minX: 0,
      minY: 0,
      maxX: 1920 / 0.02,
      maxY: 1080 / 0.02
    })

    expect(level).toBeLessThan(0.25)
    expect(keys.length).toBeLessThan(500)
  })

  test('maps negative and positive world bounds to stable tile keys', () => {
    const keys = tileKeysForWorldBounds('page', 2, {
      minX: -10,
      minY: -10,
      maxX: 260,
      maxY: 130
    })

    // Level 2 tiles span 256 world units.
    expect(keys).toHaveLength(6)
    expect(keys.map(tileKeyString)).toEqual([
      'page:2:-1:-1',
      'page:2:0:-1',
      'page:2:1:-1',
      'page:2:-1:0',
      'page:2:0:0',
      'page:2:1:0'
    ])
  })

  test('produces adjacent non-overlapping world bounds', () => {
    const first = tileWorldBounds({ pageId: 'page', level: 2, x: 0, y: 0 })
    const second = tileWorldBounds({ pageId: 'page', level: 2, x: 1, y: 0 })
    expect(first.maxX).toBe(second.minX)
    expect(first.minY).toBe(second.minY)
  })
})
