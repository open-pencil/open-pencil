import { describe, expect, test } from 'bun:test'

import type { Stroke } from '@open-pencil/scene-graph'
import { lineStrokeEnds } from '@open-pencil/scene-graph/arrow-caps'
import { strokeOverflow } from '@open-pencil/scene-graph/geometry'

// From Figma 126 stroke geometry: a 300 px line with a 6 px stroke runs its stroke along y = -3,
// over the whole line without a cap or with an equilateral arrow, and from 3 to 297 under the
// other caps.
describe('lineStrokeEnds', () => {
  test('runs half a weight above the line, end to end without a cap', () => {
    expect(lineStrokeEnds(300, 0, 6, 'NONE')).toEqual({
      start: { x: 0, y: -3 },
      end: { x: 300, y: -3 }
    })
  })

  test('comes in half a weight at each end under a cap', () => {
    for (const cap of ['ROUND', 'SQUARE', 'ARROW_LINES', 'TRIANGLE_FILLED'] as const) {
      expect(lineStrokeEnds(300, 0, 6, cap)).toEqual({
        start: { x: 3, y: -3 },
        end: { x: 297, y: -3 }
      })
    }
  })

  test('keeps the point of an equilateral arrow at the end', () => {
    expect(lineStrokeEnds(240, 0, 8, 'ARROW_EQUILATERAL')).toEqual({
      start: { x: 0, y: -4 },
      end: { x: 240, y: -4 }
    })
  })

  test('moves to the side of a line that runs at an angle', () => {
    const { start, end } = lineStrokeEnds(30, 40, 10, 'ROUND')
    expect(start.x).toBeCloseTo(7, 9)
    expect(start.y).toBeCloseTo(1, 9)
    expect(end.x).toBeCloseTo(31, 9)
    expect(end.y).toBeCloseTo(33, 9)
  })
})

describe('strokeOverflow for a line', () => {
  const stroke: Stroke = {
    type: 'SOLID',
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: 1,
    visible: true,
    weight: 6,
    align: 'INSIDE'
  }

  test('reaches a full weight past the line, whatever the alignment', () => {
    expect(strokeOverflow([stroke], 'NONE', null, { type: 'LINE' })).toBe(6)
    expect(strokeOverflow([stroke], 'NONE', null, { type: 'RECTANGLE' })).toBe(0)
  })
})
