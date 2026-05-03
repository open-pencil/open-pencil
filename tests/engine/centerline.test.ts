import { describe, test, expect } from 'bun:test'

import { fitCircleArc, isClosedThinCrescent } from '@open-pencil/core/vector'

import type { VectorNetwork } from '@open-pencil/core/scene-graph'

function makeAnnularWedge(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startDeg: number,
  sweepDeg: number,
  segmentsPerArc: number
): VectorNetwork {
  const vertices: { x: number; y: number }[] = []
  const segments: {
    start: number
    end: number
    tangentStart: { x: number; y: number }
    tangentEnd: { x: number; y: number }
  }[] = []

  for (let i = 0; i <= segmentsPerArc; i++) {
    const angle = ((startDeg + (sweepDeg * i) / segmentsPerArc) * Math.PI) / 180
    vertices.push({ x: cx + rOuter * Math.cos(angle), y: cy + rOuter * Math.sin(angle) })
  }
  for (let i = segmentsPerArc; i >= 0; i--) {
    const angle = ((startDeg + (sweepDeg * i) / segmentsPerArc) * Math.PI) / 180
    vertices.push({ x: cx + rInner * Math.cos(angle), y: cy + rInner * Math.sin(angle) })
  }

  const n = vertices.length
  for (let i = 0; i < n; i++) {
    segments.push({
      start: i,
      end: (i + 1) % n,
      tangentStart: { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 }
    })
  }

  return { vertices, segments, regions: [] }
}

describe('fitCircleArc', () => {
  test('returns null for fewer than 3 points', () => {
    expect(fitCircleArc([])).toBeNull()
    expect(fitCircleArc([{ x: 0, y: 0 }])).toBeNull()
    expect(
      fitCircleArc([
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      ])
    ).toBeNull()
  })

  test('fits points on a known circle', () => {
    const r = 100
    const pts = []
    for (let i = 0; i <= 10; i++) {
      const angle = (i / 10) * Math.PI
      pts.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) })
    }
    const result = fitCircleArc(pts)
    expect(result).not.toBeNull()
    expect(result!.r).toBeCloseTo(r, 1)
    expect(result!.cx).toBeCloseTo(0, 1)
    expect(result!.cy).toBeCloseTo(0, 1)
  })

  test('returns null for collinear points', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 }
    ]
    expect(fitCircleArc(pts)).toBeNull()
  })

  test('returns null when points do not lie on a single circle', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 0 },
      { x: 50, y: -200 }
    ]
    expect(fitCircleArc(pts)).toBeNull()
  })
})

describe('isClosedThinCrescent', () => {
  test('detects annular wedge as crescent', () => {
    const network = makeAnnularWedge(0, 0, 80, 100, 0, 180, 5)
    const result = isClosedThinCrescent(network)
    expect(result).not.toBeNull()
    expect(result!.ordered.length).toBe(network.vertices.length)
  })

  test('rejects a simple rectangle (4 vertices)', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 2, end: 3, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 3, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: []
    }
    expect(isClosedThinCrescent(network)).toBeNull()
  })

  test('rejects a regular hexagon (thick shape)', () => {
    const vertices = []
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * 2 * Math.PI
      vertices.push({ x: 100 * Math.cos(angle), y: 100 * Math.sin(angle) })
    }
    const segments = vertices.map((_, i) => ({
      start: i,
      end: (i + 1) % 6,
      tangentStart: { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 }
    }))
    expect(isClosedThinCrescent({ vertices, segments, regions: [] })).toBeNull()
  })

  test('rejects open path (segments != vertices)', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: []
    }
    expect(isClosedThinCrescent(network)).toBeNull()
  })

  test('rejects odd vertex count', () => {
    const network = makeAnnularWedge(0, 0, 80, 100, 0, 180, 4)
    const n = network.vertices.length
    if (n % 2 === 0) {
      network.vertices.push({ x: 999, y: 999 })
      network.segments.push({
        start: n - 1,
        end: n,
        tangentStart: { x: 0, y: 0 },
        tangentEnd: { x: 0, y: 0 }
      })
    }
    expect(isClosedThinCrescent(network)).toBeNull()
  })
})
