/**
 * Tests for geometry utility functions in packages/core/src/geometry.ts.
 *
 * These pure functions compute bounding boxes, rotated corners, and visual bounds
 * for scene nodes. They are used by the renderer for culling, export bounds
 * computation, and hit testing.
 */
import { describe, test, expect } from 'bun:test'

import {
  computeBounds,
  computeAbsoluteBounds,
  degToRad,
  radToDeg,
  rotatePoint,
  rotatedCorners,
  rotatedBBox
} from '@open-pencil/core'

import { computeVisualBounds } from '#core/geometry'

describe('degToRad / radToDeg', () => {
  test('degToRad converts degrees to radians', () => {
    expect(degToRad(0)).toBe(0)
    expect(degToRad(90)).toBeCloseTo(Math.PI / 2, 10)
    expect(degToRad(180)).toBeCloseTo(Math.PI, 10)
    expect(degToRad(360)).toBeCloseTo(Math.PI * 2, 10)
  })

  test('radToDeg converts radians to degrees', () => {
    expect(radToDeg(0)).toBe(0)
    expect(radToDeg(Math.PI / 2)).toBeCloseTo(90, 10)
    expect(radToDeg(Math.PI)).toBeCloseTo(180, 10)
  })

  test('roundtrip preserves value', () => {
    expect(radToDeg(degToRad(45))).toBeCloseTo(45, 10)
    expect(radToDeg(degToRad(-90))).toBeCloseTo(-90, 10)
  })
})

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

describe('computeBounds', () => {
  test('empty iterable returns zero rect', () => {
    expect(computeBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })

  test('single rect returns itself', () => {
    const r = { x: 10, y: 20, width: 30, height: 40 }
    expect(computeBounds([r])).toEqual(r)
  })

  test('multiple rects returns union', () => {
    const result = computeBounds([
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 50, y: 50, width: 100, height: 100 }
    ])
    expect(result).toEqual({ x: 0, y: 0, width: 150, height: 150 })
  })

  test('disjoint rects returns union spanning both', () => {
    const result = computeBounds([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 100, y: 100, width: 10, height: 10 }
    ])
    expect(result).toEqual({ x: 0, y: 0, width: 110, height: 110 })
  })
})

describe('computeAbsoluteBounds', () => {
  const idPos = (id: string) => {
    const map: Record<string, { x: number; y: number }> = {
      a: { x: 10, y: 20 },
      b: { x: 50, y: 60 },
      c: { x: 0, y: 0 }
    }
    return map[id] ?? { x: 0, y: 0 }
  }

  test('empty iterable returns zero rect', () => {
    expect(computeAbsoluteBounds([], idPos)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })

  test('single node returns its bounds', () => {
    const result = computeAbsoluteBounds([{ id: 'a', width: 30, height: 40 }], idPos)
    expect(result).toEqual({ x: 10, y: 20, width: 30, height: 40 })
  })

  test('multiple nodes returns union', () => {
    const result = computeAbsoluteBounds(
      [
        { id: 'a', width: 30, height: 40 },
        { id: 'b', width: 20, height: 20 }
      ],
      idPos
    )
    expect(result).toEqual({ x: 10, y: 20, width: 60, height: 60 })
  })
})

describe('computeVisualBounds', () => {
  const idPos = (id: string) => {
    const map: Record<string, { x: number; y: number }> = {
      r1: { x: 100, y: 200 },
      r2: { x: 300, y: 400 },
      rotated: { x: 0, y: 0 }
    }
    return map[id] ?? { x: 0, y: 0 }
  }

  test('empty iterable returns zero rect', () => {
    expect(computeVisualBounds([], idPos)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })

  test('single axis-aligned node returns its bounds', () => {
    const result = computeVisualBounds([{ id: 'r1', width: 50, height: 60 }], idPos)
    expect(result).toEqual({ x: 100, y: 200, width: 50, height: 60 })
  })

  test('multiple nodes returns union', () => {
    const result = computeVisualBounds(
      [
        { id: 'r1', width: 50, height: 60 },
        { id: 'r2', width: 30, height: 30 }
      ],
      idPos
    )
    expect(result).toEqual({ x: 100, y: 200, width: 230, height: 230 })
  })

  test('rotated node has expanded bbox', () => {
    const noRot = computeVisualBounds(
      [{ id: 'rotated', width: 100, height: 50, rotation: 0 }],
      idPos
    )
    const rotated = computeVisualBounds(
      [{ id: 'rotated', width: 100, height: 50, rotation: 45 }],
      idPos
    )
    // Rotated bbox should be larger
    expect(rotated.width).toBeGreaterThan(noRot.width)
    expect(rotated.height).toBeGreaterThan(noRot.height)
  })

  test('strokes expand bounds', () => {
    const noStroke = computeVisualBounds([{ id: 'r1', width: 50, height: 60, strokes: [] }], idPos)
    const withStroke = computeVisualBounds(
      [
        {
          id: 'r1',
          width: 50,
          height: 60,
          strokes: [
            {
              weight: 10,
              visible: true,
              align: 'OUTSIDE' as const,
              color: { r: 0, g: 0, b: 0, a: 1 },
              opacity: 1
            }
          ]
        }
      ],
      idPos
    )
    // OUTSIDE stroke of weight 10 adds 10 to each side
    expect(withStroke.width).toBe(noStroke.width + 20)
    expect(withStroke.height).toBe(noStroke.height + 20)
  })

  test('invisible strokes do not expand bounds', () => {
    const noStroke = computeVisualBounds([{ id: 'r1', width: 50, height: 60 }], idPos)
    const invisibleStroke = computeVisualBounds(
      [
        {
          id: 'r1',
          width: 50,
          height: 60,
          strokes: [
            {
              weight: 100,
              visible: false,
              align: 'OUTSIDE' as const,
              color: { r: 0, g: 0, b: 0, a: 1 },
              opacity: 1
            }
          ]
        }
      ],
      idPos
    )
    expect(invisibleStroke.width).toBe(noStroke.width)
    expect(invisibleStroke.height).toBe(noStroke.height)
  })

  test('CENTER stroke expands bounds by half weight', () => {
    const noStroke = computeVisualBounds([{ id: 'r1', width: 50, height: 60 }], idPos)
    const centerStroke = computeVisualBounds(
      [
        {
          id: 'r1',
          width: 50,
          height: 60,
          strokes: [
            {
              weight: 10,
              visible: true,
              align: 'CENTER' as const,
              color: { r: 0, g: 0, b: 0, a: 1 },
              opacity: 1
            }
          ]
        }
      ],
      idPos
    )
    // CENTER stroke of weight 10 adds 5 to each side
    expect(centerStroke.width).toBe(noStroke.width + 10)
    expect(centerStroke.height).toBe(noStroke.height + 10)
  })

  test('INSIDE stroke does not expand bounds', () => {
    const noStroke = computeVisualBounds([{ id: 'r1', width: 50, height: 60 }], idPos)
    const insideStroke = computeVisualBounds(
      [
        {
          id: 'r1',
          width: 50,
          height: 60,
          strokes: [
            {
              weight: 10,
              visible: true,
              align: 'INSIDE' as const,
              color: { r: 0, g: 0, b: 0, a: 1 },
              opacity: 1
            }
          ]
        }
      ],
      idPos
    )
    expect(insideStroke.width).toBe(noStroke.width)
    expect(insideStroke.height).toBe(noStroke.height)
  })

  test('DROP_SHADOW expands bounds asymmetrically based on offset', () => {
    const noEffect = computeVisualBounds([{ id: 'r1', width: 50, height: 60 }], idPos)
    const withShadow = computeVisualBounds(
      [
        {
          id: 'r1',
          width: 50,
          height: 60,
          effects: [
            {
              type: 'DROP_SHADOW' as const,
              visible: true,
              radius: 10,
              spread: 0,
              offset: { x: 5, y: -3 },
              color: { r: 0, g: 0, b: 0, a: 0.5 }
            }
          ]
        }
      ],
      idPos
    )
    // blurSpread = radius + spread = 10 + 0 = 10
    // left expansion: max(0, blurSpread + max(0, -offset.x)) = max(0, 10 + 0) = 10
    // right expansion: max(0, blurSpread + max(0, offset.x)) = max(0, 10 + 5) = 15
    // top expansion: max(0, blurSpread + max(0, -offset.y)) = max(0, 10 + 3) = 13
    // bottom expansion: max(0, blurSpread + max(0, offset.y)) = max(0, 10 + 0) = 10
    expect(withShadow.x).toBe(noEffect.x - 10)
    expect(withShadow.y).toBe(noEffect.y - 13)
    expect(withShadow.width).toBe(noEffect.width + 10 + 15)
    expect(withShadow.height).toBe(noEffect.height + 13 + 10)
  })

  test('LAYER_BLUR expands bounds by radius', () => {
    const noEffect = computeVisualBounds([{ id: 'r1', width: 50, height: 60 }], idPos)
    const withBlur = computeVisualBounds(
      [
        {
          id: 'r1',
          width: 50,
          height: 60,
          effects: [
            {
              type: 'LAYER_BLUR' as const,
              visible: true,
              radius: 20,
              spread: 0,
              offset: { x: 0, y: 0 },
              color: { r: 0, g: 0, b: 0, a: 1 }
            }
          ]
        }
      ],
      idPos
    )
    // blurSpread = 20, offset = (0,0)
    // All sides expand by 20
    expect(withBlur.width).toBe(noEffect.width + 40)
    expect(withBlur.height).toBe(noEffect.height + 40)
  })

  test('invisible effect does not expand bounds', () => {
    const noEffect = computeVisualBounds([{ id: 'r1', width: 50, height: 60 }], idPos)
    const invisibleEffect = computeVisualBounds(
      [
        {
          id: 'r1',
          width: 50,
          height: 60,
          effects: [
            {
              type: 'DROP_SHADOW' as const,
              visible: false,
              radius: 100,
              spread: 50,
              offset: { x: 200, y: 200 },
              color: { r: 0, g: 0, b: 0, a: 1 }
            }
          ]
        }
      ],
      idPos
    )
    expect(invisibleEffect).toEqual(noEffect)
  })

  test('combined OUTSIDE stroke and DROP_SHADOW expands bounds correctly', () => {
    const noEffects = computeVisualBounds([{ id: 'r1', width: 50, height: 60 }], idPos)
    const combined = computeVisualBounds(
      [
        {
          id: 'r1',
          width: 50,
          height: 60,
          strokes: [
            {
              weight: 5,
              visible: true,
              align: 'OUTSIDE' as const,
              color: { r: 0, g: 0, b: 0, a: 1 },
              opacity: 1
            }
          ],
          effects: [
            {
              type: 'DROP_SHADOW' as const,
              visible: true,
              radius: 10,
              spread: 0,
              offset: { x: 3, y: 3 },
              color: { r: 0, g: 0, b: 0, a: 0.5 }
            }
          ]
        }
      ],
      idPos
    )
    // strokeOverflow: OUTSIDE weight=5 → overflow=5
    // effectOverflow: blurSpread=10, offset=(3,3)
    //   left   = 10 + max(0, -3) = 10
    //   right  = 10 + max(0,  3) = 13
    //   top    = 10 + max(0, -3) = 10
    //   bottom = 10 + max(0,  3) = 13
    // Total left expansion: 5 (stroke) + 10 (effect) = 15
    // Total right expansion: 5 (stroke) + 13 (effect) = 18
    // Total top expansion: 5 (stroke) + 10 (effect) = 15
    // Total bottom expansion: 5 (stroke) + 13 (effect) = 18
    expect(combined.x).toBe(noEffects.x - 15)
    expect(combined.y).toBe(noEffects.y - 15)
    expect(combined.width).toBe(noEffects.width + 15 + 18) // 50 + 33 = 83
    expect(combined.height).toBe(noEffects.height + 15 + 18) // 60 + 33 = 93
  })

  test('multiple strokes takes maximum overflow', () => {
    const noEffects = computeVisualBounds([{ id: 'r1', width: 50, height: 60 }], idPos)
    const multiStroke = computeVisualBounds(
      [
        {
          id: 'r1',
          width: 50,
          height: 60,
          strokes: [
            {
              weight: 2,
              visible: true,
              align: 'OUTSIDE' as const,
              color: { r: 0, g: 0, b: 0, a: 1 },
              opacity: 1
            },
            {
              weight: 8,
              visible: true,
              align: 'CENTER' as const,
              color: { r: 0, g: 0, b: 0, a: 1 },
              opacity: 1
            },
            {
              weight: 4,
              visible: true,
              align: 'INSIDE' as const,
              color: { r: 0, g: 0, b: 0, a: 1 },
              opacity: 1
            }
          ]
        }
      ],
      idPos
    )
    // strokeOverflow takes max: OUTSIDE(2)=2, CENTER(4)=4, INSIDE(0)=0 → max=4
    expect(multiStroke.width).toBe(noEffects.width + 8) // 4 per side × 2
    expect(multiStroke.height).toBe(noEffects.height + 8)
  })

  test('multiple effects accumulate directional overflow', () => {
    const noEffects = computeVisualBounds([{ id: 'r1', width: 50, height: 60 }], idPos)
    const multiEffect = computeVisualBounds(
      [
        {
          id: 'r1',
          width: 50,
          height: 60,
          effects: [
            {
              type: 'DROP_SHADOW' as const,
              visible: true,
              radius: 5,
              spread: 0,
              offset: { x: 10, y: 0 },
              color: { r: 0, g: 0, b: 0, a: 1 }
            },
            {
              type: 'DROP_SHADOW' as const,
              visible: true,
              radius: 3,
              spread: 0,
              offset: { x: -10, y: 0 },
              color: { r: 0, g: 0, b: 0, a: 1 }
            }
          ]
        }
      ],
      idPos
    )
    // Effect 1: blurSpread=5, offset=(10,0) → left=5, right=15, top=5, bottom=5
    // Effect 2: blurSpread=3, offset=(-10,0) → left=13, right=3, top=3, bottom=3
    // After Math.max: left=max(5,13)=13, right=max(15,3)=15, top=max(5,3)=5, bottom=max(5,3)=5
    expect(multiEffect.x).toBe(noEffects.x - 13)
    expect(multiEffect.width).toBe(noEffects.width + 13 + 15) // 50 + 28 = 78
    expect(multiEffect.y).toBe(noEffects.y - 5)
    expect(multiEffect.height).toBe(noEffects.height + 5 + 5) // 60 + 10 = 70
  })
})
