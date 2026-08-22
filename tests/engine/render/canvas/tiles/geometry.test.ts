import { describe, expect, test } from 'bun:test'

import {
  TILE_DEVICE_SIZE,
  tileKeyString,
  tileKeysForWorldBounds,
  tileLevel,
  tileWorldBounds,
  tileWorldSize
} from '#core/canvas/renderer/tiles'

describe('tile geometry', () => {
  test('quantizes scale upward and keeps fixed device-pixel targets', () => {
    expect(tileLevel(1)).toBe(1)
    expect(tileLevel(1.01)).toBe(1.25)
    expect(tileLevel(1.26)).toBe(1.5)
    expect(tileWorldSize(2)).toBe(TILE_DEVICE_SIZE / 2)
  })

  test('maps negative and positive world bounds to stable tile keys', () => {
    const keys = tileKeysForWorldBounds('page', 2, {
      minX: -10,
      minY: -10,
      maxX: 260,
      maxY: 130
    })

    expect(keys).toHaveLength(12)
    expect(keys.map(tileKeyString)).toEqual([
      'page:2:-1:-1',
      'page:2:0:-1',
      'page:2:1:-1',
      'page:2:2:-1',
      'page:2:-1:0',
      'page:2:0:0',
      'page:2:1:0',
      'page:2:2:0',
      'page:2:-1:1',
      'page:2:0:1',
      'page:2:1:1',
      'page:2:2:1'
    ])
  })

  test('produces adjacent non-overlapping world bounds', () => {
    const first = tileWorldBounds({ pageId: 'page', level: 2, x: 0, y: 0 })
    const second = tileWorldBounds({ pageId: 'page', level: 2, x: 1, y: 0 })
    expect(first.maxX).toBe(second.minX)
    expect(first.minY).toBe(second.minY)
  })
})
