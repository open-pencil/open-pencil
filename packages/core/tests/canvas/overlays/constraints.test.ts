import { describe, expect, test } from 'bun:test'

import { constraintSegments } from '#core/canvas/overlays/constraints'

// A 40×20 layer at 30,10 in a 100×60 parent: its sides' middles are at y = 20 and x = 50.
const box = { x: 30, y: 10, width: 40, height: 20 }
const parent = { width: 100, height: 60 }

describe('constraint indicator lines', () => {
  test('Left and Top run from the middle of those sides to the parent edges', () => {
    expect(constraintSegments(box, parent, 'MIN', 'MIN')).toEqual([
      [0, 20, 30, 20],
      [50, 0, 50, 10]
    ])
  })

  test('Right and Bottom run from the far sides to the far edges', () => {
    expect(constraintSegments(box, parent, 'MAX', 'MAX')).toEqual([
      [70, 20, 100, 20],
      [50, 30, 50, 60]
    ])
  })

  test('Left & Right and Top & Bottom reach all four edges', () => {
    expect(constraintSegments(box, parent, 'STRETCH', 'STRETCH')).toEqual([
      [0, 20, 30, 20],
      [70, 20, 100, 20],
      [50, 0, 50, 10],
      [50, 30, 50, 60]
    ])
  })

  test('Center on both axes is a cross over the middle half of the layer', () => {
    expect(constraintSegments(box, parent, 'CENTER', 'CENTER')).toEqual([
      [40, 20, 60, 20],
      [50, 15, 50, 25]
    ])
  })

  test('Center on one axis is a line over the middle half beside the other axis lines', () => {
    expect(constraintSegments(box, parent, 'CENTER', 'MIN')).toEqual([
      [40, 20, 60, 20],
      [50, 0, 50, 10]
    ])
    expect(constraintSegments(box, parent, 'MAX', 'CENTER')).toEqual([
      [70, 20, 100, 20],
      [50, 15, 50, 25]
    ])
  })

  test('Scale draws nothing', () => {
    expect(constraintSegments(box, parent, 'SCALE', 'SCALE')).toEqual([])
    expect(constraintSegments(box, parent, 'SCALE', 'MIN')).toEqual([[50, 0, 50, 10]])
  })

  test('an axis whose layers differ draws nothing', () => {
    expect(constraintSegments(box, parent, null, 'MAX')).toEqual([[50, 30, 50, 60]])
    expect(constraintSegments(box, parent, null, null)).toEqual([])
  })
})
