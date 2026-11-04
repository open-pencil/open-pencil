import { describe, expect, test } from 'bun:test'

import {
  SHAPE_WITH_TEXT_TYPES,
  fitShapeWithTextHeight,
  shapeWithTextGrows,
  shapeWithTextLabelBox
} from '@open-pencil/scene-graph/shape-with-text'

describe('shape-with-text label boxes and fit', () => {
  for (const type of SHAPE_WITH_TEXT_TYPES) {
    test(`${type} keeps its label inside the box`, () => {
      const box = shapeWithTextLabelBox(type, 200, 100)
      // A file's 64 px folds leave a short one no room, as in FigJam, but never a negative box.
      expect(box.width).toBeGreaterThan(0)
      expect(box.height).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(200)
      expect(box.y + box.height).toBeLessThanOrEqual(100)
    })
  }

  test('a small shape keeps every label box inside it', () => {
    for (const type of SHAPE_WITH_TEXT_TYPES) {
      const box = shapeWithTextLabelBox(type, 20, 20)
      expect(box.x + box.width).toBeLessThanOrEqual(20)
      expect(box.y + box.height).toBeLessThanOrEqual(20)
    }
  })

  test('a zero-sized shape gives an empty label box instead of a negative one', () => {
    expect(shapeWithTextLabelBox('SQUARE', 0, 0)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })

  test('label boxes sit where FigJam lays its labels out', () => {
    // Read from FigJam's saved label layouts: [x, width] across a 176 px wide shape.
    const measured = [
      ['SQUARE', 16, 144],
      ['ELLIPSE', 26, 124],
      ['DIAMOND', 48, 80],
      ['TRIANGLE_UP', 44, 88],
      ['PARALLELOGRAM_RIGHT', 42.9, 90.19],
      ['ENG_QUEUE', 24, 88],
      ['CHEVRON', 43, 90],
      ['STAR', 34.38, 107.25]
    ] as const
    for (const [type, x, width] of measured) {
      const box = shapeWithTextLabelBox(type, 176, 400)
      expect([box.x, box.width]).toEqual([expect.closeTo(x, 1), expect.closeTo(width, 1)])
    }
  })

  test('a small shape leaves 8 px around its label', () => {
    expect(shapeWithTextLabelBox('SQUARE', 80, 80)).toEqual({ x: 8, y: 8, width: 64, height: 64 })
    expect(shapeWithTextLabelBox('SQUARE', 100, 100).x).toBe(16)
  })

  /** A label `height` px tall at any width. */
  const lines = (height: number) => () => ({ width: 40, height })

  test('a shape keeps the height it was given while its label fits', () => {
    expect(fitShapeWithTextHeight('SQUARE', 176, 176, lines(24))).toBe(176)
  })

  test('a shape grows to the height FigJam grows it to, and never wider', () => {
    // Label heights and the heights FigJam grew a 176 px wide shape to for them.
    const grown = [
      ['SQUARE', 264, 296],
      ['ELLIPSE', 336, 474],
      ['DIAMOND', 504, 1024],
      ['TRIANGLE_UP', 480, 1074],
      ['ENG_DATABASE', 264, 352],
      ['PENTAGON', 288, 449],
      ['STAR', 336, 572],
      ['PLUS', 264, 594]
    ] as const
    for (const [type, label, height] of grown) {
      expect(fitShapeWithTextHeight(type, 176, 176, lines(label))).toBe(height)
    }
  })

  test('summing junctions and ors stay round, their label running past them', () => {
    for (const type of ['SUMMING_JUNCTION', 'OR'] as const) {
      expect(shapeWithTextGrows(type)).toBe(false)
      expect(fitShapeWithTextHeight(type, 176, 176, lines(600))).toBe(176)
    }
  })
})
