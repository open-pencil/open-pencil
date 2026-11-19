import { describe, expect, test } from 'bun:test'

import { dotGridSpacing } from '#core/canvas/page/background'

describe('board dot grid', () => {
  // Figma desktop, FigJam board: dots every 16 units from 50%, doubling below to stay 8 px apart.
  test('doubles the spacing as FigJam does when zoomed out', () => {
    const zooms = [4, 1, 0.75, 0.5, 0.4, 0.33, 0.25, 0.2, 0.1]
    expect(zooms.map((zoom) => dotGridSpacing(16, zoom))).toEqual([
      16, 16, 16, 16, 32, 32, 32, 64, 128
    ])
  })
})
