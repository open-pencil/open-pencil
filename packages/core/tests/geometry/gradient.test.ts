import { describe, expect, test } from 'bun:test'

import {
  gradientHandleLayout,
  gradientHandles,
  gradientStopPosition,
  hitTestGradientHandles,
  moveGradientHandle
} from '#core/geometry'
import type { Vector } from '@open-pencil/scene-graph'

// A 200 × 140 layer with a linear gradient from its left edge's middle to its right edge's middle:
// Figma's identity transform.
const LEFT_TO_RIGHT = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
const STOPS = [
  { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
  { position: 0.5, color: { r: 1, g: 1, b: 0, a: 1 } },
  { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
]

function close(actual: Vector, expected: Vector) {
  expect(actual.x).toBeCloseTo(expected.x, 6)
  expect(actual.y).toBeCloseTo(expected.y, 6)
}

describe('gradient handles', () => {
  test('a linear gradient runs between its two end dots', () => {
    const handles = gradientHandles('GRADIENT_LINEAR', LEFT_TO_RIGHT, 200, 140)
    close(handles.start, { x: 0, y: 70 })
    close(handles.end, { x: 200, y: 70 })
  })

  // Figma desktop 126: dragging the end moves only the end, exactly with the pointer.
  test('dragging an end moves only that end', () => {
    const moved = moveGradientHandle('GRADIENT_LINEAR', LEFT_TO_RIGHT, 200, 140, 'end', {
      x: 200,
      y: 10
    })
    const handles = gradientHandles('GRADIENT_LINEAR', moved, 200, 140)
    close(handles.start, { x: 0, y: 70 })
    close(handles.end, { x: 200, y: 10 })
  })

  // Figma desktop 126, a 400 × 120 layer: dragging the end of a left-to-right gradient to
  // (300, 120) gave this transform, keeping the second axis square to the line on screen.
  test('a dragged end keeps the second axis as Figma does', () => {
    const moved = moveGradientHandle('GRADIENT_LINEAR', LEFT_TO_RIGHT, 400, 120, 'end', {
      x: 300,
      y: 120
    })
    const figma = [1.2820513, 0.0769231, -0.0384615, -0.8547009, 1.2820513, -0.1410256]
    expect([moved.m00, moved.m01, moved.m02, moved.m10, moved.m11, moved.m12].map((v) => +v.toFixed(5))).toEqual(
      figma.map((v) => +v.toFixed(5))
    )
  })

  // Figma desktop 126: the pointer at −10.2° from the start lands on −15°, at the pointer's distance.
  test('Shift turns an end in 15° steps and keeps its distance', () => {
    const pointer = { x: 195.5, y: 35 }
    const moved = moveGradientHandle(
      'GRADIENT_LINEAR',
      LEFT_TO_RIGHT,
      200,
      140,
      'end',
      pointer,
      true
    )
    const { start, end } = gradientHandles('GRADIENT_LINEAR', moved, 200, 140)
    const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI
    expect(angle).toBeCloseTo(-15, 6)
    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeCloseTo(
      Math.hypot(pointer.x, pointer.y - 70),
      6
    )
  })

  test('a stop slides to where the pointer projects onto the line, within its ends', () => {
    expect(gradientStopPosition('GRADIENT_LINEAR', LEFT_TO_RIGHT, 200, 140, { x: 150, y: 3 })).toBe(
      0.75
    )
    expect(gradientStopPosition('GRADIENT_LINEAR', LEFT_TO_RIGHT, 200, 140, { x: -40, y: 70 })).toBe(
      0
    )
  })

  test('an angular stop follows the pointer around the centre', () => {
    const centred = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    // Straight below the centre is a quarter turn, as the sweep runs clockwise from the right.
    expect(
      gradientStopPosition('GRADIENT_ANGULAR', centred, 200, 140, { x: 100, y: 130 })
    ).toBeCloseTo(0.25, 6)
    expect(
      gradientStopPosition('GRADIENT_ANGULAR', centred, 200, 140, { x: 100, y: 10 })
    ).toBeCloseTo(0.75, 6)
  })

  // Figma desktop 126 puts the squares on the left of the line's run from the first stop to the
  // last: above a left-to-right gradient, below a right-to-left one, right of a top-to-bottom one.
  test('stop squares sit on the left of the run from the first stop to the last', () => {
    const screen = (point: Vector) => point
    const above = gradientHandleLayout('GRADIENT_LINEAR', LEFT_TO_RIGHT, STOPS, 200, 140, screen)
    expect(above.stops[1]?.center.y).toBeLessThan(70)
    // Its first stop at the right edge and its last at the left.
    const reversed = { m00: -1, m01: 0, m02: 1, m10: 0, m11: -1, m12: 1 }
    const below = gradientHandleLayout('GRADIENT_LINEAR', reversed, STOPS, 200, 140, screen)
    expect(below.stops[1]?.center.y).toBeGreaterThan(70)
    // Its first stop at the top edge and its last at the bottom.
    const downward = { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 }
    const right = gradientHandleLayout('GRADIENT_LINEAR', downward, STOPS, 200, 140, screen)
    expect(right.stops[1]?.center.x).toBeGreaterThan(100)
  })

  test('a press takes a stop square before an end dot', () => {
    const screen = (point: Vector) => point
    const layout = gradientHandleLayout('GRADIENT_LINEAR', LEFT_TO_RIGHT, STOPS, 200, 140, screen)
    const square = layout.stops[2]?.center
    if (!square) throw new Error('Expected a stop square')
    expect(hitTestGradientHandles(layout, square)).toEqual({ kind: 'stop', index: 2 })
    expect(hitTestGradientHandles(layout, { x: 0, y: 72 })).toEqual({
      kind: 'handle',
      handle: 'start'
    })
    expect(hitTestGradientHandles(layout, { x: 50, y: 120 })).toBeNull()
  })
})
