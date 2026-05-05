/**
 * Tests for the TransformMatrix module (packages/core/src/canvas/matrix.ts).
 *
 * TransformMatrix is a lightweight 3x3 matrix library for 2D affine transforms.
 * It handles translation, rotation, scaling, inversion, and point mapping.
 * Used by the renderer for world-space coordinate computation and culling.
 */
import { describe, test, expect } from 'bun:test'

import { TransformMatrix } from '@open-pencil/core'

import { expectDefined } from '../helpers/assert'

describe('TransformMatrix.identity', () => {
  test('produces a 3x3 identity matrix', () => {
    const id = TransformMatrix.identity()
    expect(id).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
  })
})

describe('TransformMatrix.multiply', () => {
  test('identity * identity = identity', () => {
    const id = TransformMatrix.identity()
    expect(TransformMatrix.multiply(id, id)).toEqual(id)
  })

  test('multiply with no args returns identity', () => {
    expect(TransformMatrix.multiply()).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
  })

  test('translate then rotate preserves translation', () => {
    const t = TransformMatrix.translated(10, 20)
    const r = TransformMatrix.rotated(0) // no rotation
    const result = TransformMatrix.multiply(t, r)
    // Translation should be preserved
    expect(result[2]).toBeCloseTo(10, 10)
    expect(result[5]).toBeCloseTo(20, 10)
  })

  test('two translations compose additively', () => {
    const t1 = TransformMatrix.translated(10, 20)
    const t2 = TransformMatrix.translated(5, 15)
    const result = TransformMatrix.multiply(t1, t2)
    // Combined translation: (15, 35)
    expect(result[2]).toBeCloseTo(15, 10)
    expect(result[5]).toBeCloseTo(35, 10)
  })

  test('two scalings compose multiplicatively', () => {
    const s1 = TransformMatrix.scaled(2, 3)
    const s2 = TransformMatrix.scaled(4, 5)
    const result = TransformMatrix.multiply(s1, s2)
    // Combined scale: (8, 15)
    expect(result[0]).toBeCloseTo(8, 10)
    expect(result[4]).toBeCloseTo(15, 10)
  })
})

describe('TransformMatrix.translated', () => {
  test('produces correct translation matrix', () => {
    const t = TransformMatrix.translated(100, 200)
    expect(t).toEqual([1, 0, 100, 0, 1, 200, 0, 0, 1])
  })

  test('zero translation is identity', () => {
    expect(TransformMatrix.translated(0, 0)).toEqual(TransformMatrix.identity())
  })
})

describe('TransformMatrix.rotated', () => {
  test('zero rotation is identity', () => {
    const r = TransformMatrix.rotated(0)
    expect(r[0]).toBeCloseTo(1, 10)
    expect(r[1]).toBeCloseTo(0, 10)
    expect(r[3]).toBeCloseTo(0, 10)
    expect(r[4]).toBeCloseTo(1, 10)
  })

  test('90° rotation produces correct matrix', () => {
    const r = TransformMatrix.rotated(Math.PI / 2)
    expect(r[0]).toBeCloseTo(0, 10)
    expect(r[1]).toBeCloseTo(-1, 10)
    expect(r[3]).toBeCloseTo(1, 10)
    expect(r[4]).toBeCloseTo(0, 10)
  })

  test('180° rotation negates both axes', () => {
    const r = TransformMatrix.rotated(Math.PI)
    expect(r[0]).toBeCloseTo(-1, 10)
    expect(r[4]).toBeCloseTo(-1, 10)
  })

  test('rotation around arbitrary pivot point', () => {
    // Rotate 90° around (50, 50)
    const r = TransformMatrix.rotated(Math.PI / 2, 50, 50)
    // Map (50, 50) through rotation → should stay at (50, 50)
    const pt = TransformMatrix.mapPoint(r, { x: 50, y: 50 })
    expect(pt.x).toBeCloseTo(50, 10)
    expect(pt.y).toBeCloseTo(50, 10)
    // Map (100, 50) → (50, 100) for 90° around (50,50)
    const pt2 = TransformMatrix.mapPoint(r, { x: 100, y: 50 })
    expect(pt2.x).toBeCloseTo(50, 10)
    expect(pt2.y).toBeCloseTo(100, 10)
  })
})

describe('TransformMatrix.scaled', () => {
  test('uniform scaling from origin', () => {
    const s = TransformMatrix.scaled(2, 3)
    expect(s[0]).toBe(2)
    expect(s[4]).toBe(3)
    expect(s[2]).toBe(0)
    expect(s[5]).toBe(0)
  })

  test('scaling around pivot point', () => {
    // Scale 2x around (50, 50)
    const s = TransformMatrix.scaled(2, 2, 50, 50)
    // Map (50, 50) → (50, 50) — pivot is invariant
    const pt = TransformMatrix.mapPoint(s, { x: 50, y: 50 })
    expect(pt.x).toBeCloseTo(50, 10)
    expect(pt.y).toBeCloseTo(50, 10)
    // Map (60, 60) → (70, 70) — 2x scaling around (50,50): (60-50)*2+50 = 70
    const pt2 = TransformMatrix.mapPoint(s, { x: 60, y: 60 })
    expect(pt2.x).toBeCloseTo(70, 10)
    expect(pt2.y).toBeCloseTo(70, 10)
  })

  test('scale of 1 is identity', () => {
    const s = TransformMatrix.scaled(1, 1)
    expect(s).toEqual(TransformMatrix.identity())
  })
})

describe('TransformMatrix.invert', () => {
  test('inverse of identity is identity', () => {
    const id = TransformMatrix.identity()
    const inv = TransformMatrix.invert(id)
    const inverse = expectDefined(inv, 'inverse matrix')
    expect(inverse).toEqual(id)
  })

  test('inverse of translation is negative translation', () => {
    const t = TransformMatrix.translated(10, 20)
    const inv = TransformMatrix.invert(t)
    const inverse = expectDefined(inv, 'inverse matrix')
    expect(inverse[2]).toBeCloseTo(-10, 10)
    expect(inverse[5]).toBeCloseTo(-20, 10)
  })

  test('inverse of rotation is negative rotation', () => {
    const r = TransformMatrix.rotated(Math.PI / 4)
    const inv = TransformMatrix.invert(r)
    const inverse = expectDefined(inv, 'inverse matrix')
    // Rotation by -π/4
    const expected = TransformMatrix.rotated(-Math.PI / 4)
    for (let i = 0; i < 9; i++) {
      expect(inverse[i]).toBeCloseTo(expected[i], 10)
    }
  })

  test('compose with inverse gives identity', () => {
    const m = TransformMatrix.multiply(
      TransformMatrix.translated(10, 20),
      TransformMatrix.rotated(Math.PI / 6)
    )
    const inv = TransformMatrix.invert(m)
    const inverse = expectDefined(inv, 'inverse matrix')
    const product = TransformMatrix.multiply(m, inverse)
    for (let i = 0; i < 9; i++) {
      expect(product[i]).toBeCloseTo(TransformMatrix.identity()[i], 10)
    }
  })

  test('singular matrix returns null', () => {
    const singular = [0, 0, 0, 0, 0, 0, 0, 0, 0]
    expect(TransformMatrix.invert(singular)).toBeNull()
  })
})

describe('TransformMatrix.mapPoints', () => {
  test('identity maps points to themselves', () => {
    const id = TransformMatrix.identity()
    expect(TransformMatrix.mapPoints(id, [10, 20])).toEqual([10, 20])
  })

  test('translation adds to coordinates', () => {
    const t = TransformMatrix.translated(5, 10)
    expect(TransformMatrix.mapPoints(t, [0, 0])).toEqual([5, 10])
    expect(TransformMatrix.mapPoints(t, [100, 200])).toEqual([105, 210])
  })

  test('multiple points mapped correctly', () => {
    const s = TransformMatrix.scaled(2, 3)
    const result = TransformMatrix.mapPoints(s, [1, 2, 3, 4])
    expect(result[0]).toBeCloseTo(2, 10)
    expect(result[1]).toBeCloseTo(6, 10)
    expect(result[2]).toBeCloseTo(6, 10)
    expect(result[3]).toBeCloseTo(12, 10)
  })

  test('odd-length array throws error', () => {
    expect(() => TransformMatrix.mapPoints(TransformMatrix.identity(), [1, 2, 3])).toThrow(
      'mapPoints requires even length'
    )
  })
})

describe('TransformMatrix.mapPoint', () => {
  test('returns Vector object', () => {
    const id = TransformMatrix.identity()
    const result = TransformMatrix.mapPoint(id, { x: 42, y: 99 })
    expect(result).toEqual({ x: 42, y: 99 })
  })

  test('rotation by 90° maps correctly', () => {
    const r = TransformMatrix.rotated(Math.PI / 2)
    const result = TransformMatrix.mapPoint(r, { x: 1, y: 0 })
    expect(result.x).toBeCloseTo(0, 10)
    expect(result.y).toBeCloseTo(1, 10)
  })
})

describe('composed transforms (realistic world matrix chains)', () => {
  test('translate then scale: point (0,0) maps to translated position', () => {
    // Simulates a node at position (100, 200) with no rotation/flip
    // getNodeLocalMatrix: translate(100,200) * translate(cx,cy) * translate(-cx,-cy)
    // The inner translate(cx,cy) * translate(-cx,-cy) cancels out
    // So the result is just translate(100, 200)
    const cx = 50 // width/2
    const cy = 30 // height/2
    let m = TransformMatrix.identity()
    m = TransformMatrix.multiply(m, TransformMatrix.translated(100, 200))
    m = TransformMatrix.multiply(m, TransformMatrix.translated(cx, cy))
    m = TransformMatrix.multiply(m, TransformMatrix.translated(-cx, -cy))

    const origin = TransformMatrix.mapPoints(m, [0, 0])
    expect(origin[0]).toBeCloseTo(100, 10)
    expect(origin[1]).toBeCloseTo(200, 10)
  })

  test('translate then rotate 90° around center: corners map correctly', () => {
    // A 100x100 node at position (0, 0) rotated 90° around center (50, 50)
    const cx = 50
    const cy = 50
    const rad = Math.PI / 2

    let m = TransformMatrix.identity()
    m = TransformMatrix.multiply(m, TransformMatrix.translated(0, 0)) // position
    m = TransformMatrix.multiply(m, TransformMatrix.translated(cx, cy)) // pivot to center
    m = TransformMatrix.multiply(m, TransformMatrix.rotated(rad)) // rotate
    m = TransformMatrix.multiply(m, TransformMatrix.translated(-cx, -cy)) // pivot back

    // Origin (0,0) rotated 90° around (50,50) → (100, 0)
    const origin = TransformMatrix.mapPoints(m, [0, 0])
    expect(origin[0]).toBeCloseTo(100, 10)
    expect(origin[1]).toBeCloseTo(0, 10)

    // Center (50,50) should be invariant
    const center = TransformMatrix.mapPoints(m, [50, 50])
    expect(center[0]).toBeCloseTo(50, 10)
    expect(center[1]).toBeCloseTo(50, 10)
  })

  test('translate + rotate + scale: full chain produces correct world position', () => {
    // A 200x100 node at position (300, 400), rotated 45°, flipped X
    const cx = 100 // width/2
    const cy = 50 // height/2
    const rad = (45 * Math.PI) / 180

    let m = TransformMatrix.identity()
    m = TransformMatrix.multiply(m, TransformMatrix.translated(300, 400)) // position
    m = TransformMatrix.multiply(m, TransformMatrix.translated(cx, cy)) // pivot to center
    m = TransformMatrix.multiply(m, TransformMatrix.scaled(-1, 1)) // flipX
    m = TransformMatrix.multiply(m, TransformMatrix.rotated(rad)) // rotate 45°
    m = TransformMatrix.multiply(m, TransformMatrix.translated(-cx, -cy)) // pivot back

    // The center (100, 50) should map to (300+100, 400+50) = (400, 450)
    // because rotation around center leaves center invariant (flipX doesn't affect center either)
    const center = TransformMatrix.mapPoints(m, [100, 50])
    expect(center[0]).toBeCloseTo(400, 5)
    expect(center[1]).toBeCloseTo(450, 5)

    // The origin (0,0) should be rotated and flipped
    const origin = TransformMatrix.mapPoints(m, [0, 0])
    // Verify it's NOT at (300, 400) — it should be transformed
    expect(origin[0]).not.toBeCloseTo(300, 1)
  })

  test('two-level nesting: parent translate + child translate composes correctly', () => {
    // Parent at (100, 200), child at (50, 30) relative to parent
    // Child's world position should be (150, 230)
    const parentMatrix = TransformMatrix.multiply(
      TransformMatrix.identity(),
      TransformMatrix.translated(100, 200)
    )

    // Child's local matrix (simplified, no rotation/flip, 80x60 node)
    const cx = 40
    const cy = 30
    let childLocal = TransformMatrix.identity()
    childLocal = TransformMatrix.multiply(childLocal, TransformMatrix.translated(50, 30))
    childLocal = TransformMatrix.multiply(childLocal, TransformMatrix.translated(cx, cy))
    childLocal = TransformMatrix.multiply(childLocal, TransformMatrix.translated(-cx, -cy))

    // World matrix = parent * child
    const worldMatrix = TransformMatrix.multiply(parentMatrix, childLocal)

    // Origin of child in world space
    const origin = TransformMatrix.mapPoints(worldMatrix, [0, 0])
    expect(origin[0]).toBeCloseTo(150, 10)
    expect(origin[1]).toBeCloseTo(230, 10)

    // Center of child (40, 30) in world space should be (150+40, 230+30) = (190, 260)
    const center = TransformMatrix.mapPoints(worldMatrix, [40, 30])
    expect(center[0]).toBeCloseTo(190, 10)
    expect(center[1]).toBeCloseTo(260, 10)
  })

  test('inverse of world matrix maps world position back to local', () => {
    // Node at (100, 200) with 30° rotation
    const rad = (30 * Math.PI) / 180
    const cx = 50
    const cy = 25

    let m = TransformMatrix.identity()
    m = TransformMatrix.multiply(m, TransformMatrix.translated(100, 200))
    m = TransformMatrix.multiply(m, TransformMatrix.translated(cx, cy))
    m = TransformMatrix.multiply(m, TransformMatrix.rotated(rad))
    m = TransformMatrix.multiply(m, TransformMatrix.translated(-cx, -cy))

    const inv = TransformMatrix.invert(m)
    const inverse = expectDefined(inv, 'inverse matrix')

    // Map origin to world, then back to local
    const worldOrigin = TransformMatrix.mapPoints(m, [0, 0])
    const localOrigin = TransformMatrix.mapPoints(inverse, worldOrigin)
    expect(localOrigin[0]).toBeCloseTo(0, 8)
    expect(localOrigin[1]).toBeCloseTo(0, 8)

    // Map center to world, then back
    const worldCenter = TransformMatrix.mapPoints(m, [50, 25])
    const localCenter = TransformMatrix.mapPoints(inverse, worldCenter)
    expect(localCenter[0]).toBeCloseTo(50, 8)
    expect(localCenter[1]).toBeCloseTo(25, 8)
  })
})
