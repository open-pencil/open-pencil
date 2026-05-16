import { describe, test, expect } from 'bun:test'

import { rotatePoint, rotatedBBox, rotatedCorners } from '@open-pencil/core'

describe('rotatePoint', () => {
  test('no rotation returns same point', () => {
    const result = rotatePoint(10, 20, 0, 0, 0)
    expect(result.x).toBeCloseTo(10, 10)
    expect(result.y).toBeCloseTo(20, 10)
  })

  test('90° rotation around origin', () => {
    const result = rotatePoint(1, 0, 0, 0, Math.PI / 2)
    expect(result.x).toBeCloseTo(0, 10)
    expect(result.y).toBeCloseTo(1, 10)
  })

  test('180° rotation negates both axes', () => {
    const result = rotatePoint(1, 0, 0, 0, Math.PI)
    expect(result.x).toBeCloseTo(-1, 10)
    expect(result.y).toBeCloseTo(0, 10)
  })

  test('rotation around non-origin center', () => {
    // Rotate (1,0) around (0.5, 0.5) by 90° → (1, 1)
    const result = rotatePoint(1, 0, 0.5, 0.5, Math.PI / 2)
    expect(result.x).toBeCloseTo(1, 10)
    expect(result.y).toBeCloseTo(1, 10)
  })
})

describe('rotatedCorners', () => {
  test('zero rotation returns axis-aligned corners', () => {
    const [tl, tr, br, bl] = rotatedCorners(50, 50, 50, 50, 0)
    expect(tl).toEqual({ x: 0, y: 0 })
    expect(tr).toEqual({ x: 100, y: 0 })
    expect(br).toEqual({ x: 100, y: 100 })
    expect(bl).toEqual({ x: 0, y: 100 })
  })

  test('90° rotation swaps width and height positions', () => {
    const [tl, tr, br, bl] = rotatedCorners(50, 50, 50, 25, 90)
    // After 90° rotation: corners should be at different positions
    // The center (50,50) stays the same
    const cx = (tl.x + tr.x + br.x + bl.x) / 4
    const cy = (tl.y + tr.y + br.y + bl.y) / 4
    expect(cx).toBeCloseTo(50, 10)
    expect(cy).toBeCloseTo(50, 10)
  })
})

describe('rotatedBBox', () => {
  test('zero rotation returns input as bbox', () => {
    const bbox = rotatedBBox(10, 20, 30, 40, 0)
    expect(bbox).toEqual({
      left: 10,
      right: 40,
      top: 20,
      bottom: 60,
      centerX: 25,
      centerY: 40
    })
  })

  test('45° rotation of square expands bbox', () => {
    const bbox = rotatedBBox(0, 0, 100, 100, 45)
    // A 100x100 square rotated 45° has a bbox of ~141.4 wide/tall
    const side = Math.sqrt(100 * 100 * 2)
    expect(bbox.right - bbox.left).toBeCloseTo(side, 5)
    expect(bbox.bottom - bbox.top).toBeCloseTo(side, 5)
    // Center should remain at (50, 50)
    expect(bbox.centerX).toBeCloseTo(50, 5)
    expect(bbox.centerY).toBeCloseTo(50, 5)
  })

  test('90° rotation of rectangle swaps dimensions', () => {
    const bbox = rotatedBBox(0, 0, 200, 100, 90)
    // A 200x100 rect rotated 90° around its center (100, 50) → bbox 100x200
    // The center is at (100, 50) regardless of rotation
    expect(bbox.centerX).toBeCloseTo(100, 5)
    expect(bbox.centerY).toBeCloseTo(50, 5)
    // Width of bbox = original height, height of bbox = original width
    expect(bbox.right - bbox.left).toBeCloseTo(100, 5)
    expect(bbox.bottom - bbox.top).toBeCloseTo(200, 5)
  })

  test('negative rotation works correctly', () => {
    const pos = rotatedBBox(0, 0, 100, 100, -45)
    const neg = rotatedBBox(0, 0, 100, 100, 45)
    // Bounding box should be same size regardless of rotation direction
    expect(pos.right - pos.left).toBeCloseTo(neg.right - neg.left, 5)
    expect(pos.bottom - pos.top).toBeCloseTo(neg.bottom - neg.top, 5)
  })
})

