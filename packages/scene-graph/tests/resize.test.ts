import { describe, expect, test } from 'bun:test'

import type { ConstraintType } from '@open-pencil/scene-graph'
import { constrainedChildRect } from '@open-pencil/scene-graph/resize'

// Live Figma, 2026-10-10: a locked 100×50 rectangle at 50,50 in a 200×200 frame.
const child = { x: 50, y: 50, width: 100, height: 50 }
const square = { width: 200, height: 200 }

function resized(
  horizontal: ConstraintType,
  vertical: ConstraintType,
  after: { width: number; height: number },
  ratio: number | null = 2
) {
  return constrainedChildRect(child, square, after, horizontal, vertical, ratio)
}

describe('constraints with a locked aspect ratio', () => {
  test('the one axis that follows the parent sizes the other', () => {
    expect(resized('STRETCH', 'MIN', { width: 300, height: 200 })).toEqual({
      x: 50,
      y: 50,
      width: 200,
      height: 100
    })
    expect(resized('MIN', 'STRETCH', { width: 200, height: 400 })).toEqual({
      x: 50,
      y: 50,
      width: 500,
      height: 250
    })
    expect(resized('SCALE', 'MIN', { width: 300, height: 200 })).toEqual({
      x: 75,
      y: 50,
      width: 150,
      height: 75
    })
  })

  test('the derived axis keeps the edge or centre its constraint pins', () => {
    const wider = { width: 300, height: 200 }
    expect(resized('STRETCH', 'MAX', wider)).toEqual({ x: 50, y: 0, width: 200, height: 100 })
    expect(resized('STRETCH', 'CENTER', wider)).toEqual({ x: 50, y: 25, width: 200, height: 100 })
    const taller = { width: 200, height: 400 }
    expect(resized('MAX', 'SCALE', taller)).toEqual({ x: -50, y: 100, width: 200, height: 100 })
    expect(resized('CENTER', 'SCALE', taller)).toEqual({ x: 0, y: 100, width: 200, height: 100 })
  })

  test('the ratio gives way when both axes or neither follow the parent', () => {
    const wider = { width: 300, height: 200 }
    expect(resized('STRETCH', 'STRETCH', wider)).toEqual({ x: 50, y: 50, width: 200, height: 50 })
    expect(resized('SCALE', 'SCALE', wider)).toEqual({ x: 75, y: 50, width: 150, height: 50 })
    expect(resized('CENTER', 'CENTER', wider)).toEqual({ x: 100, y: 50, width: 100, height: 50 })
  })

  test('an unlocked child follows each constraint on its own', () => {
    expect(resized('STRETCH', 'MIN', { width: 300, height: 200 }, null)).toEqual({
      x: 50,
      y: 50,
      width: 200,
      height: 50
    })
  })
})
