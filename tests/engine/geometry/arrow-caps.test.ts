import { describe, expect, test } from 'bun:test'

import type { Stroke, VectorNetwork } from '@open-pencil/scene-graph'
import type { ArrowEndpoint } from '@open-pencil/scene-graph/arrow-caps'
import {
  arrowCapOverflow,
  arrowLinesSegments,
  collectArrowEndpoints,
  equilateralArrowPoints,
  isArrowCap,
  lineArrowEndpoints
} from '@open-pencil/scene-graph/arrow-caps'
import { strokeOverflow } from '@open-pencil/scene-graph/geometry'

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
  test('recognizes both arrow cap kinds and nothing else', () => {
    expect(isArrowCap('ARROW_LINES')).toBe(true)
    expect(isArrowCap('ARROW_EQUILATERAL')).toBe(true)
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

describe('equilateralArrowPoints', () => {
  test('builds a weight-scaled equilateral head with the tip at the endpoint', () => {
    const [tip, left, right] = equilateralArrowPoints(10, 5, 0, 1)

    expect(tip.x).toBeCloseTo(10, 5)
    expect(tip.y).toBeCloseTo(5, 5)
    expect(left.x).toBeCloseTo(10 - 2 * SQRT3, 5)
    expect(left.y).toBeCloseTo(5 - 2, 5)
    expect(right.x).toBeCloseTo(10 - 2 * SQRT3, 5)
    expect(right.y).toBeCloseTo(5 + 2, 5)
  })

  test('rotates with the endpoint angle', () => {
    const [tip, left, right] = equilateralArrowPoints(0, 0, Math.PI / 2, 1)

    expect(tip.x).toBeCloseTo(0, 5)
    expect(tip.y).toBeCloseTo(0, 5)
    expect(left.y).toBeCloseTo(-2 * SQRT3, 5)
    expect(right.y).toBeCloseTo(-2 * SQRT3, 5)
    expect([left.x, right.x].sort((a, b) => a - b)[0]).toBeCloseTo(-2, 5)
    expect([left.x, right.x].sort((a, b) => a - b)[1]).toBeCloseTo(2, 5)
  })

  test('scales linearly with stroke weight', () => {
    const [, left] = equilateralArrowPoints(0, 0, 0, 3)

    expect(left.x).toBeCloseTo(-6 * SQRT3, 5)
    expect(left.y).toBeCloseTo(-6, 5)
  })
})

describe('arrowLinesSegments', () => {
  test('builds two wings sweeping back from the tip', () => {
    const [first, second] = arrowLinesSegments(10, 5, 0, 1)

    expect(first.from.x).toBeCloseTo(10, 5)
    expect(first.from.y).toBeCloseTo(5, 5)
    expect(second.from.x).toBeCloseTo(10, 5)
    expect(second.from.y).toBeCloseTo(5, 5)
    const tips = [first.to, second.to].sort((a, b) => a.y - b.y)
    expect(tips[0].x).toBeCloseTo(10 - 2 * SQRT3, 5)
    expect(tips[0].y).toBeCloseTo(5 - 2, 5)
    expect(tips[1].x).toBeCloseTo(10 - 2 * SQRT3, 5)
    expect(tips[1].y).toBeCloseTo(5 + 2, 5)
  })

  test('scales linearly with stroke weight', () => {
    const [first] = arrowLinesSegments(0, 0, 0, 2)
    const length = Math.hypot(first.to.x - first.from.x, first.to.y - first.from.y)

    expect(length).toBeCloseTo(8, 5)
  })
})

describe('lineArrowEndpoints', () => {
  test('a horizontal line gets outward endpoints at both ends', () => {
    const endpoints = lineArrowEndpoints(100, 0, 'ARROW_EQUILATERAL')

    expect(endpoints).toHaveLength(2)
    const start = endpointAt(endpoints, 0)
    const end = endpointAt(endpoints, 100)
    expect(Math.abs(start.angle)).toBeCloseTo(Math.PI, 5)
    expect(end.angle).toBeCloseTo(0, 5)
  })

  test('a diagonal line points its endpoints along the line direction', () => {
    const endpoints = lineArrowEndpoints(30, 40, 'ARROW_LINES')
    const end = endpointAt(endpoints, 30)

    expect(end.y).toBe(40)
    expect(end.angle).toBeCloseTo(Math.atan2(40, 30), 5)
  })

  test('returns nothing for non-arrow caps', () => {
    expect(lineArrowEndpoints(100, 0, 'ROUND')).toHaveLength(0)
    expect(lineArrowEndpoints(100, 0, 'NONE')).toHaveLength(0)
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
  test('an arrow cap reserves the full head reach plus wing stroke width', () => {
    expect(arrowCapOverflow([stroke({ cap: 'ARROW_EQUILATERAL', weight: 3 })])).toBe(13.5)
    expect(arrowCapOverflow([stroke({ cap: 'ARROW_LINES', weight: 2 })])).toBe(9)
  })

  test('the fallback cap applies when the stroke has none', () => {
    expect(arrowCapOverflow([stroke({ weight: 2 })], 'ARROW_LINES')).toBe(9)
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
    expect(arrowCapOverflow([stroke({ weight: 2 })], 'NONE', network)).toBe(9)
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
  test('arrow heads widen the stroke overflow past the weight pad', () => {
    expect(strokeOverflow([stroke({ cap: 'ARROW_EQUILATERAL' })])).toBe(18)
    expect(strokeOverflow([stroke({ weight: 4 })], 'ARROW_LINES')).toBe(18)
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
    expect(strokeOverflow([stroke({ weight: 4 })], 'NONE', network)).toBe(18)
  })

  test('non-arrow strokes keep the align-based overflow', () => {
    expect(strokeOverflow([stroke()])).toBe(2)
  })
})
