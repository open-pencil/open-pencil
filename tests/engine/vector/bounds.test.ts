import { describe, test, expect } from 'bun:test'

import { computeVectorBounds } from '@open-pencil/core'

describe('computeVectorBounds', () => {
  test('empty network', () => {
    expect(computeVectorBounds({ vertices: [], segments: [], regions: [] })).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0
    })
  })

  test('single vertex', () => {
    const bounds = computeVectorBounds({
      vertices: [{ x: 50, y: 30, handleMirroring: 'NONE' }],
      segments: [],
      regions: []
    })
    expect(bounds.x).toBe(50)
    expect(bounds.y).toBe(30)
    expect(bounds.width).toBe(0)
    expect(bounds.height).toBe(0)
  })

  test('two vertices', () => {
    const bounds = computeVectorBounds({
      vertices: [
        { x: 0, y: 0, handleMirroring: 'NONE' },
        { x: 100, y: 50, handleMirroring: 'NONE' }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    })
    expect(bounds).toEqual({ x: 0, y: 0, width: 100, height: 50 })
  })

  test('bezier curve extrema extend bounds', () => {
    const bounds = computeVectorBounds({
      vertices: [
        { x: 0, y: 0, handleMirroring: 'NONE' },
        { x: 100, y: 0, handleMirroring: 'NONE' }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: -50 }, tangentEnd: { x: 0, y: 50 } }],
      regions: []
    })
    // Curve extrema at t=(3±√3)/6, not at control points
    expect(bounds.y).toBeCloseTo(-14.4338, 3)
    expect(bounds.height).toBeCloseTo(28.8675, 3)
  })
})
