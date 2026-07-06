import { describe, expect, test } from 'bun:test'

import type { Vector } from '@open-pencil/core'
import { clipBoundsToPolygon, clipPolygon } from '@open-pencil/scene-graph'

describe('clipPolygon', () => {
  test('returns the subject unchanged when the clip has fewer than 3 corners', () => {
    const subject: Vector[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ]
    expect(clipPolygon(subject, [])).toBe(subject)
    expect(
      clipPolygon(subject, [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
      ])
    ).toBe(subject)
  })

  test('returns null when the subject is fully outside the clip', () => {
    const subject: Vector[] = [
      { x: 100, y: 100 },
      { x: 110, y: 100 },
      { x: 110, y: 110 },
      { x: 100, y: 110 }
    ]
    const clip: Vector[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ]
    expect(clipPolygon(subject, clip)).toBeNull()
  })

  test('preserves the clipped polygon across a chain so a later clip excludes corners the inner clip removed', () => {
    // Subject: the full [0,100]² square.
    const subject: Vector[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ]

    // Inner clip D1: the diamond inscribed in the square (corners at the edge
    // midpoints). It removes the four square corners, including (0,0).
    const d1: Vector[] = [
      { x: 50, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 50 }
    ]

    // Outer clip D2: a small square [0,30]² covering the (0,0) corner that D1
    // already removed. If the chain collapsed D1's result to its AABB ([0,100]²,
    // which re-adds the corner) before applying D2, the corner would survive.
    // Preserving the polygon keeps it excluded: the only surviving region is the
    // triangle where the diamond's x+y=50 edge meets [0,30]², i.e. AABB
    // [20,30]×[20,30].
    const d2: Vector[] = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 30 },
      { x: 0, y: 30 }
    ]

    const afterD1 = clipPolygon(subject, d1)
    expect(afterD1).not.toBeNull()
    const clipped = afterD1 ? clipPolygon(afterD1, d2) : null
    expect(clipped).not.toBeNull()
    expect(clipped?.length).toBeGreaterThanOrEqual(3)

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const p of clipped ?? []) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }

    // The corner (0,0) must stay excluded: the result does not reach below 20.
    expect(minX).toBeGreaterThanOrEqual(20)
    expect(minY).toBeGreaterThanOrEqual(20)
    expect(maxX).toBeLessThanOrEqual(30)
    expect(maxY).toBeLessThanOrEqual(30)
  })

  test('clipBoundsToPolygon agrees with clipPolygon for a single axis-aligned clip', () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    const clip: Vector[] = [
      { x: 25, y: 25 },
      { x: 75, y: 25 },
      { x: 75, y: 75 },
      { x: 25, y: 75 }
    ]

    const aabb = clipBoundsToPolygon(bounds, clip)
    expect(aabb).toEqual({ minX: 25, minY: 25, maxX: 75, maxY: 75 })
  })
})
