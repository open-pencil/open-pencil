import { describe, expect, test } from 'bun:test'

import { constraintSegments } from '#core/canvas/overlays/constraints'

// A 40×20 layer at 30,10 in a 100×60 parent: its sides' middles are at y = 20 and x = 50.
const box = { x: 30, y: 10, width: 40, height: 20 }
const parent = { width: 100, height: 60 }

describe('constraint indicator lines', () => {
  test('Left and Top run from the middle of those sides to the parent edges', () => {
    expect(constraintSegments(box, parent, 'MIN', 'MIN', 6)).toEqual([
      [0, 20, 30, 20],
      [50, 0, 50, 10]
    ])
  })

  test('Right and Bottom run from the far sides to the far edges', () => {
    expect(constraintSegments(box, parent, 'MAX', 'MAX', 6)).toEqual([
      [70, 20, 100, 20],
      [50, 30, 50, 60]
    ])
  })

  test('Left & Right and Top & Bottom reach all four edges', () => {
    expect(constraintSegments(box, parent, 'STRETCH', 'STRETCH', 6)).toEqual([
      [0, 20, 30, 20],
      [70, 20, 100, 20],
      [50, 0, 50, 10],
      [50, 30, 50, 60]
    ])
  })

  test('Center on both axes is a small cross at the centre', () => {
    expect(constraintSegments(box, parent, 'CENTER', 'CENTER', 6)).toEqual([
      [44, 20, 56, 20],
      [50, 14, 50, 26]
    ])
  })

  test('Center on one axis is a short line through the centre beside the other axis lines', () => {
    expect(constraintSegments(box, parent, 'CENTER', 'MIN', 6)).toEqual([
      [44, 20, 56, 20],
      [50, 0, 50, 10]
    ])
    expect(constraintSegments(box, parent, 'MAX', 'CENTER', 6)).toEqual([
      [70, 20, 100, 20],
      [50, 14, 50, 26]
    ])
  })

  test('Scale draws nothing', () => {
    expect(constraintSegments(box, parent, 'SCALE', 'SCALE', 6)).toEqual([])
    expect(constraintSegments(box, parent, 'SCALE', 'MIN', 6)).toEqual([[50, 0, 50, 10]])
  })
})
