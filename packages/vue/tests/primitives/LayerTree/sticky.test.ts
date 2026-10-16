import { describe, expect, test } from 'bun:test'

import type { LayerRow } from '#vue/primitives/LayerTree/context'
import { stickyTopLevelRow } from '#vue/primitives/LayerTree/sticky'

const H = 24

/** Rows at the given levels; a row has children when the next row is deeper. */
function rows(levels: number[]): LayerRow[] {
  return levels.map((level, index) => ({
    node: {
      id: `n${index}`,
      name: `n${index}`,
      type: 'FRAME',
      layoutMode: 'NONE',
      visible: true,
      locked: false
    },
    level,
    hasChildren: (levels[index + 1] ?? 0) > level
  }))
}

describe('the pinned top-level layer', () => {
  // A frame with five children, then a second frame with two.
  const list = rows([1, 2, 2, 2, 2, 2, 1, 2, 2])

  test('pins nothing before the list scrolls or while the row is still in view', () => {
    expect(stickyTopLevelRow(list, 0, H)).toBeNull()
  })

  test('pins the frame whose children are scrolling beneath it', () => {
    expect(stickyTopLevelRow(list, 2 * H, H)).toEqual({ index: 0, offset: 0 })
  })

  test('is pushed up by the next top-level row, then replaced by it', () => {
    // Still 10 px below the pinned row: not touching it yet.
    expect(stickyTopLevelRow(list, 5 * H - 10, H)).toEqual({ index: 0, offset: 0 })
    // 10 px into the pinned row's slot: it is pushed 10 px up.
    expect(stickyTopLevelRow(list, 5 * H + 10, H)).toEqual({ index: 0, offset: -10 })
    expect(stickyTopLevelRow(list, 6 * H + 5, H)).toEqual({ index: 6, offset: 0 })
  })

  test('pins only an expanded top-level layer with children', () => {
    // Top-level rows with no children showing: nothing to pin.
    expect(stickyTopLevelRow(rows([1, 1, 1, 1, 1]), 2 * H, H)).toBeNull()
  })
})
