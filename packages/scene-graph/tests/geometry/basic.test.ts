import { describe, expect, test } from 'bun:test'

import { strokeOverflow } from '@open-pencil/scene-graph/geometry'

describe('strokeOverflow at mitered corners', () => {
  const stroke = {
    type: 'SOLID' as const,
    color: { r: 0, g: 0, b: 0, a: 1 },
    weight: 10,
    opacity: 1,
    visible: true,
    align: 'CENTER' as const
  }
  const zero = { x: 0, y: 0 }
  /** An open chevron whose apex is a 40° corner. */
  const half = Math.tan((20 * Math.PI) / 180) * 100
  const chevron = {
    vertices: [
      { x: -half, y: 100 },
      { x: 0, y: 0 },
      { x: half, y: 100 }
    ],
    segments: [
      { start: 0, end: 1, tangentStart: zero, tangentEnd: zero },
      { start: 1, end: 2, tangentStart: zero, tangentEnd: zero }
    ],
    regions: []
  }

  test('reaches the miter tip, as Figma’s render bounds do', () => {
    // Half the weight over sin(20°): 14.6.
    expect(strokeOverflow([stroke], 'NONE', chevron, { strokeJoin: 'MITER' })).toBeCloseTo(
      5 / Math.sin((20 * Math.PI) / 180),
      6
    )
  })

  test('stays at half the weight for round joins and past the miter limit', () => {
    expect(strokeOverflow([stroke], 'NONE', chevron, { strokeJoin: 'ROUND' })).toBe(5)
    expect(
      strokeOverflow([stroke], 'NONE', chevron, { strokeJoin: 'MITER', strokeMiterLimit: 2 })
    ).toBe(5)
  })

  test('reaches a miter where a vector’s regions meet at a junction', () => {
    // Two regions split triangle ABC along A→(100, 30); region strokes join AB and AC around A.
    const network = {
      vertices: [
        { x: 0, y: 30 },
        { x: 100, y: 0 },
        { x: 100, y: 60 },
        { x: 100, y: 30 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: zero, tangentEnd: zero },
        { start: 1, end: 3, tangentStart: zero, tangentEnd: zero },
        { start: 3, end: 2, tangentStart: zero, tangentEnd: zero },
        { start: 2, end: 0, tangentStart: zero, tangentEnd: zero },
        { start: 0, end: 3, tangentStart: zero, tangentEnd: zero }
      ],
      regions: [
        { windingRule: 'NONZERO' as const, loops: [[0, 1, 4]] },
        { windingRule: 'NONZERO' as const, loops: [[4, 2, 3]] }
      ]
    }
    const outside = { ...stroke, weight: 20, align: 'OUTSIDE' as const }
    // The full weight over sin(θ/2), θ the 33.4° corner at A.
    expect(strokeOverflow([outside], 'NONE', network, { strokeJoin: 'MITER' })).toBeCloseTo(
      20 / Math.sin(Math.atan(0.3)),
      6
    )
  })
})
