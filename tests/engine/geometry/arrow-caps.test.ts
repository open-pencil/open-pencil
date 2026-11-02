import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Stroke, type VectorNetwork } from '@open-pencil/scene-graph'
import type { ArrowEndpoint } from '@open-pencil/scene-graph/arrow-caps'
import {
  arrowCapOverflow,
  arrowLinesSegments,
  collectArrowEndpoints,
  circleCapRadius,
  diamondCapPoints,
  equilateralArrowPoints,
  isArrowCap,
  triangleCapPoints,
  trimArrowShafts
} from '@open-pencil/scene-graph/arrow-caps'
import { strokeOverflow } from '@open-pencil/scene-graph/geometry'
import type { Vector } from '@open-pencil/scene-graph/primitives'

const SQRT3 = Math.sqrt(3)

function endpointAt(endpoints: ArrowEndpoint[], x: number): ArrowEndpoint {
  const match = endpoints.find((endpoint) => endpoint.x === x)
  if (!match) throw new Error(`no endpoint at x=${x}`)
  return match
}

function straightOpenLine(): VectorNetwork {
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    ],
    segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
    regions: []
  }
}

describe('isArrowCap', () => {
  test('recognizes the arrow and filled head caps and nothing else', () => {
    expect(isArrowCap('ARROW_LINES')).toBe(true)
    expect(isArrowCap('ARROW_EQUILATERAL')).toBe(true)
    expect(isArrowCap('TRIANGLE_FILLED')).toBe(true)
    expect(isArrowCap('DIAMOND_FILLED')).toBe(true)
    expect(isArrowCap('CIRCLE_FILLED')).toBe(true)
    expect(isArrowCap('ROUND')).toBe(false)
    expect(isArrowCap('SQUARE')).toBe(false)
    expect(isArrowCap('NONE')).toBe(false)
    expect(isArrowCap(undefined)).toBe(false)
  })
})

describe('collectArrowEndpoints', () => {
  test('returns both open ends of a straight segment pointing outward', () => {
    const endpoints = collectArrowEndpoints(straightOpenLine(), 'ARROW_EQUILATERAL')

    expect(endpoints).toHaveLength(2)
    const start = endpointAt(endpoints, 0)
    const end = endpointAt(endpoints, 100)
    expect(start.y).toBe(0)
    expect(Math.abs(start.angle)).toBeCloseTo(Math.PI, 5)
    expect(start.cap).toBe('ARROW_EQUILATERAL')
    expect(end.y).toBe(0)
    expect(end.angle).toBeCloseTo(0, 5)
    expect(end.cap).toBe('ARROW_EQUILATERAL')
  })

  test('returns nothing when the effective cap is not an arrow', () => {
    expect(collectArrowEndpoints(straightOpenLine(), 'ROUND')).toHaveLength(0)
    expect(collectArrowEndpoints(straightOpenLine(), 'NONE')).toHaveLength(0)
  })

  test('per-vertex caps override the fallback cap', () => {
    const network = straightOpenLine()
    network.vertices[0] = { x: 0, y: 0, strokeCap: 'ROUND' }
    const endpoints = collectArrowEndpoints(network, 'ARROW_LINES')

    expect(endpoints).toHaveLength(1)
    expect(endpoints[0].x).toBe(100)
    expect(endpoints[0].cap).toBe('ARROW_LINES')
  })

  test('a per-vertex arrow cap applies even when the fallback is NONE', () => {
    const network = straightOpenLine()
    network.vertices[1] = { x: 100, y: 0, strokeCap: 'ARROW_EQUILATERAL' }
    const endpoints = collectArrowEndpoints(network, 'NONE')

    expect(endpoints).toHaveLength(1)
    expect(endpoints[0].x).toBe(100)
    expect(endpoints[0].cap).toBe('ARROW_EQUILATERAL')
  })

  test('closed loops have no arrow endpoints', () => {
    const closedTriangle: VectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 80 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: []
    }

    expect(collectArrowEndpoints(closedTriangle, 'ARROW_EQUILATERAL')).toHaveLength(0)
  })

  test('interior polyline vertices are not endpoints', () => {
    const polyline: VectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 40 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: []
    }

    const endpoints = collectArrowEndpoints(polyline, 'ARROW_LINES')
    expect(endpoints).toHaveLength(2)
    const coordinates = endpoints.map((endpoint) => [endpoint.x, endpoint.y]).sort()
    expect(coordinates).toEqual([
      [0, 0],
      [50, 40]
    ])
  })

  test('curved terminal segments take their angle from the bezier tangent', () => {
    const curve: VectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 20 }, tangentEnd: { x: 0, y: -20 } }],
      regions: []
    }

    const endpoints = collectArrowEndpoints(curve, 'ARROW_EQUILATERAL')
    const start = endpointAt(endpoints, 0)
    const end = endpointAt(endpoints, 100)
    expect(start.angle).toBeCloseTo(-Math.PI / 2, 5)
    expect(end.angle).toBeCloseTo(Math.PI / 2, 5)
  })
})

// Figma's stroke outlines for a line from (0, 0) to (200, 0), measured on 2026-10-16.
describe('equilateralArrowPoints', () => {
  test('comes to its point at the end and spreads 5/√3 weights either side, 5 back', () => {
    const [tip, left, right] = equilateralArrowPoints(200, 0, 0, 4)

    expect(tip).toEqual({ x: 200, y: 0 })
    expect(left.x).toBeCloseTo(180, 5)
    expect(left.y).toBeCloseTo(-11.547, 3)
    expect(right.x).toBeCloseTo(180, 5)
    expect(right.y).toBeCloseTo(11.547, 3)
  })

  test('rotates with the endpoint angle', () => {
    const [tip, left, right] = equilateralArrowPoints(0, 0, Math.PI / 2, 1)

    expect(tip).toEqual({ x: 0, y: 0 })
    expect(left.y).toBeCloseTo(-5, 5)
    expect(right.y).toBeCloseTo(-5, 5)
    expect([left.x, right.x].sort((p, q) => p - q)[0]).toBeCloseTo(-5 / SQRT3, 5)
    expect([left.x, right.x].sort((p, q) => p - q)[1]).toBeCloseTo(5 / SQRT3, 5)
  })

  test('scales linearly with stroke weight', () => {
    const [, left] = equilateralArrowPoints(200, 0, 0, 10)

    expect(left.x).toBeCloseTo(150, 5)
    expect(left.y).toBeCloseTo(-28.8675, 3)
  })
})

describe('arrowLinesSegments', () => {
  test('meets at the end and runs 4.5 weights back at 45°', () => {
    const [first, second] = arrowLinesSegments(200, 0, 0, 1)

    expect(first.from).toEqual({ x: 200, y: 0 })
    expect(second.from).toEqual({ x: 200, y: 0 })
    const ends = [first.to, second.to].sort((p, q) => p.y - q.y)
    expect(ends[0].x).toBeCloseTo(196.818, 3)
    expect(ends[0].y).toBeCloseTo(-3.182, 3)
    expect(ends[1].x).toBeCloseTo(196.818, 3)
    expect(ends[1].y).toBeCloseTo(3.182, 3)
  })

  test('scales linearly with stroke weight', () => {
    const [first] = arrowLinesSegments(200, 0, 0, 4)

    expect(first.to.x).toBeCloseTo(187.272, 3)
    expect(Math.abs(first.to.y)).toBeCloseTo(12.728, 3)
  })
})

function stroke(overrides: Partial<Stroke> = {}): Stroke {
  return {
    type: 'SOLID',
    color: { r: 0, g: 0, b: 0, a: 1 },
    weight: 4,
    opacity: 1,
    visible: true,
    align: 'CENTER',
    ...overrides
  }
}

describe('arrowCapOverflow', () => {
  // A triangle head on a line shorter than it reaches furthest: from the end to its base corners.
  const REACH = Math.hypot(5, 5 / Math.sqrt(3))

  test('a short line reserves room for a triangle head longer than itself', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const line = graph.createNode('VECTOR', page, {
      width: 1,
      height: 0,
      strokes: [stroke({ weight: 4 })],
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 1, y: 0, strokeCap: 'ARROW_EQUILATERAL' }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: []
      }
    })
    const [, base] = equilateralArrowPoints(1, 0, 0, 4)
    // The head's base corner, 19 back from the line's start, stays inside the reserved room.
    expect(-base.x).toBeLessThanOrEqual(arrowCapOverflow(line.strokes, 'NONE', line.vectorNetwork))
  })

  test('an arrow cap reserves the furthest any head reaches', () => {
    expect(arrowCapOverflow([stroke({ cap: 'ARROW_EQUILATERAL', weight: 3 })])).toBeCloseTo(
      3 * REACH,
      5
    )
    expect(arrowCapOverflow([stroke({ cap: 'ARROW_LINES', weight: 2 })])).toBeCloseTo(2 * REACH, 5)
  })

  test('the fallback cap applies when the stroke has none', () => {
    expect(arrowCapOverflow([stroke({ weight: 2 })], 'ARROW_LINES')).toBeCloseTo(2 * REACH, 5)
  })

  test('a vertex-only arrow cap still reserves overflow', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0, strokeCap: 'ARROW_EQUILATERAL' }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    }
    expect(arrowCapOverflow([stroke({ weight: 2 })], 'NONE', network)).toBeCloseTo(2 * REACH, 5)
    expect(arrowCapOverflow([stroke({ weight: 2 })], 'NONE')).toBe(0)
  })

  test('an explicit non-arrow cap beats an arrow fallback', () => {
    expect(arrowCapOverflow([stroke({ cap: 'ROUND' })], 'ARROW_EQUILATERAL')).toBe(0)
  })

  test('invisible and capless strokes contribute nothing', () => {
    expect(arrowCapOverflow([stroke({ cap: 'ARROW_LINES', visible: false })])).toBe(0)
    expect(arrowCapOverflow([stroke()])).toBe(0)
    expect(arrowCapOverflow(undefined)).toBe(0)
  })
})

describe('strokeOverflow with arrow caps', () => {
  const REACH = 4 * Math.hypot(5, 5 / Math.sqrt(3))

  test('arrow heads widen the stroke overflow past the weight pad', () => {
    expect(strokeOverflow([stroke({ cap: 'ARROW_EQUILATERAL' })])).toBeCloseTo(REACH, 5)
    expect(strokeOverflow([stroke({ weight: 4 })], 'ARROW_LINES')).toBeCloseTo(REACH, 5)
  })

  test('a vertex-only arrow cap widens overflow through the network parameter', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0, strokeCap: 'ARROW_LINES' },
        { x: 100, y: 0 }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    }
    expect(strokeOverflow([stroke({ weight: 4 })], 'NONE', network)).toBeCloseTo(REACH, 5)
  })

  test('non-arrow strokes keep the align-based overflow', () => {
    expect(strokeOverflow([stroke()])).toBe(2)
  })
})

// Stroke outlines Figma gives for a line from (0, 0) to (200, 0) at weight 4, recorded 2026-10-15.
describe('filled heads', () => {
  const rounded = (points: Vector[]) =>
    points.map(({ x, y }) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000 + 0])

  test('a triangle spreads across the end and narrows back to the line', () => {
    expect(rounded(triangleCapPoints(200, 0, 0, 4))).toEqual([
      [180, 2],
      [200, 11.547],
      [200, -11.547],
      [180, -2]
    ])
  })

  test('a diamond and a circle sit centred on the end', () => {
    expect(rounded(diamondCapPoints(200, 0, 0, 4))).toEqual([
      [211.547, 0],
      [200, 11.547],
      [188.453, 0],
      [200, -11.547]
    ])
    expect(circleCapRadius(4)).toBeCloseTo(10.6667, 4)
  })

  test('a straight end stays straight when the line stops short, so its corner keeps its radius', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: 0, y: 60 },
        { x: 100, y: 60, strokeCap: 'TRIANGLE_FILLED' }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: []
    }
    const trimmed = trimArrowShafts(network, 'NONE', 8)
    expect(trimmed.vertices[2]).toMatchObject({ x: 64, y: 60 })
    expect(trimmed.segments[1]).toMatchObject({
      tangentStart: { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 }
    })
  })

  test('both ends of an open path that meet at one point stop short of their heads', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0, strokeCap: 'TRIANGLE_FILLED' },
        { x: 100, y: 0 },
        { x: 0, y: 0, strokeCap: 'TRIANGLE_FILLED' }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: []
    }
    const trimmed = trimArrowShafts(network, 'NONE', 4)
    expect(trimmed.vertices[0].x).toBeCloseTo(18, 6)
    expect(trimmed.vertices[2].x).toBeCloseTo(18, 6)
  })

  test('the line stops 4.5 weights short of a triangle or equilateral head only', () => {
    const network = straightOpenLine()
    network.vertices[0].strokeCap = 'CIRCLE_FILLED'
    network.vertices[1].strokeCap = 'TRIANGLE_FILLED'
    const trimmed = trimArrowShafts(network, 'NONE', 4)
    expect(trimmed.vertices[0]).toMatchObject({ x: 0, y: 0 })
    expect(trimmed.vertices[1].x).toBeCloseTo(82, 6)
    expect(trimmed.vertices[1].y).toBeCloseTo(0, 6)
    expect(network.vertices[1].x).toBe(100)
  })

  test('the line stops 4.5 weights short of an equilateral head, as of a triangle', () => {
    const network = straightOpenLine()
    network.vertices[1].strokeCap = 'ARROW_EQUILATERAL'
    expect(trimArrowShafts(network, 'NONE', 4).vertices[1].x).toBeCloseTo(82, 6)
  })
})
