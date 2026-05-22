import { describe, test, expect } from 'bun:test'

import { computeAbsoluteBounds, computeBounds, type Vector } from '@open-pencil/core'

import { computeDescendantVisualBounds, computeVisualBounds } from '#core/geometry'

function commandsBlobFromPoints(points: Vector[]): Uint8Array {
  const blob = new Uint8Array(points.length * 9 + 1)
  const view = new DataView(blob.buffer)
  let offset = 0
  for (const point of points) {
    blob[offset] = 1
    view.setFloat32(offset + 1, point.x, true)
    view.setFloat32(offset + 5, point.y, true)
    offset += 9
  }
  blob[offset] = 0
  return blob
}

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
    const map: Record<string, Vector> = {
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
    const map: Record<string, Vector> = {
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
    expect(combined.x).toBe(noEffects.x - 15)
    expect(combined.y).toBe(noEffects.y - 15)
    expect(combined.width).toBe(noEffects.width + 15 + 18)
    expect(combined.height).toBe(noEffects.height + 15 + 18)
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
    expect(multiStroke.width).toBe(noEffects.width + 8)
    expect(multiStroke.height).toBe(noEffects.height + 8)
  })

  test('inside stroke geometry does not expand export bounds', () => {
    const strokeGeometry = [
      {
        commandsBlob: commandsBlobFromPoints([
          { x: -1, y: -1 },
          { x: 101, y: 51 }
        ])
      }
    ]
    const nodes = {
      inside: {
        id: 'inside',
        type: 'COMPONENT',
        width: 100,
        height: 50,
        visible: true,
        strokes: [
          {
            weight: 1,
            visible: true,
            align: 'INSIDE' as const,
            color: { r: 0, g: 0, b: 0, a: 1 },
            opacity: 1
          }
        ],
        strokeGeometry,
        childIds: []
      },
      outside: {
        id: 'outside',
        type: 'FRAME',
        width: 100,
        height: 50,
        visible: true,
        strokes: [
          {
            weight: 1,
            visible: true,
            align: 'OUTSIDE' as const,
            color: { r: 0, g: 0, b: 0, a: 1 },
            opacity: 1
          }
        ],
        strokeGeometry,
        childIds: []
      }
    }

    const insideBounds = computeDescendantVisualBounds(
      ['inside'],
      (id) => nodes[id as keyof typeof nodes],
      () => ({ x: 10, y: 20 })
    )
    const outsideBounds = computeDescendantVisualBounds(
      ['outside'],
      (id) => nodes[id as keyof typeof nodes],
      () => ({ x: 10, y: 20 })
    )

    expect(insideBounds).toEqual({ minX: 10, minY: 20, maxX: 110, maxY: 70 })
    expect(outsideBounds).toEqual({ minX: 9, minY: 19, maxX: 111, maxY: 71 })
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
    expect(multiEffect.x).toBe(noEffects.x - 13)
    expect(multiEffect.width).toBe(noEffects.width + 13 + 15)
    expect(multiEffect.y).toBe(noEffects.y - 5)
    expect(multiEffect.height).toBe(noEffects.height + 5 + 5)
  })
})
