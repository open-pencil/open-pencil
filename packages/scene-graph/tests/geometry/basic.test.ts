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
})
