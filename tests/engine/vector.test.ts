import { describe, test, expect } from 'bun:test'

import {
  encodeVectorNetworkBlob,
  decodeVectorNetworkBlob,
  computeVectorBounds,
  normalizeVectorNetwork,
  validateVectorNetwork,
  type VectorNetwork
} from '@open-pencil/core'

import {
  lineNetwork,
  triangleNetwork,
  vectorNetwork,
  vectorSegment,
  vectorVertex
} from '../helpers/vector-network'

describe('vectorNetworkBlob round-trip', () => {
  test('empty network', () => {
    const network: VectorNetwork = { vertices: [], segments: [], regions: [] }
    const blob = encodeVectorNetworkBlob(network)
    const decoded = decodeVectorNetworkBlob(blob)
    expect(decoded.vertices).toHaveLength(0)
    expect(decoded.segments).toHaveLength(0)
    expect(decoded.regions).toHaveLength(0)
  })

  test('single line segment', () => {
    const network = lineNetwork()
    const blob = encodeVectorNetworkBlob(network)
    const decoded = decodeVectorNetworkBlob(blob)
    expect(decoded.vertices).toHaveLength(2)
    expect(decoded.vertices[0].x).toBeCloseTo(0)
    expect(decoded.vertices[1].x).toBeCloseTo(100)
    expect(decoded.vertices[1].y).toBeCloseTo(50)
    expect(decoded.segments).toHaveLength(1)
    expect(decoded.segments[0].start).toBe(0)
    expect(decoded.segments[0].end).toBe(1)
  })

  test('cubic bezier segment', () => {
    const network = vectorNetwork(
      [
        { ...vectorVertex(0, 0), handleMirroring: 'ANGLE' },
        { ...vectorVertex(100, 100), handleMirroring: 'ANGLE' }
      ],
      [vectorSegment(0, 1, { x: 30, y: 0 }, { x: -30, y: 0 })]
    )
    const blob = encodeVectorNetworkBlob(network)
    const decoded = decodeVectorNetworkBlob(blob)
    expect(decoded.segments[0].tangentStart.x).toBeCloseTo(30)
    expect(decoded.segments[0].tangentEnd.x).toBeCloseTo(-30)
  })

  test('network with region', () => {
    const network = triangleNetwork()
    const blob = encodeVectorNetworkBlob(network)
    const decoded = decodeVectorNetworkBlob(blob)
    expect(decoded.regions).toHaveLength(1)
    expect(decoded.regions[0].windingRule).toBe('NONZERO')
    expect(decoded.regions[0].loops).toEqual([[0, 1, 2]])
  })

  test('region with EVENODD winding', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'NONE' },
        { x: 10, y: 0, handleMirroring: 'NONE' },
        { x: 10, y: 10, handleMirroring: 'NONE' },
        { x: 0, y: 10, handleMirroring: 'NONE' }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 2, end: 3, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 3, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: [{ windingRule: 'EVENODD', loops: [[0, 1, 2, 3]] }]
    }
    const blob = encodeVectorNetworkBlob(network)
    const decoded = decodeVectorNetworkBlob(blob)
    expect(decoded.regions[0].windingRule).toBe('EVENODD')
  })

  test('multiple regions with multiple loops', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'NONE' },
        { x: 10, y: 0, handleMirroring: 'NONE' },
        { x: 10, y: 10, handleMirroring: 'NONE' }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: [
        { windingRule: 'NONZERO', loops: [[0, 1], [2]] },
        { windingRule: 'EVENODD', loops: [[0, 2]] }
      ]
    }
    const blob = encodeVectorNetworkBlob(network)
    const decoded = decodeVectorNetworkBlob(blob)
    expect(decoded.regions).toHaveLength(2)
    expect(decoded.regions[0].loops).toEqual([[0, 1], [2]])
    expect(decoded.regions[1].loops).toEqual([[0, 2]])
  })
})

describe('normalizeVectorNetwork', () => {
  test('passes through segments that already have tangents', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 5, y: 0 }, tangentEnd: { x: -5, y: 0 } }],
      regions: []
    }
    const result = normalizeVectorNetwork(network)
    expect(result.segments[0].tangentStart).toEqual({ x: 5, y: 0 })
    expect(result.segments[0].tangentEnd).toEqual({ x: -5, y: 0 })
  })

  test('defaults missing tangentStart and tangentEnd to zero', () => {
    const network = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ],
      segments: [{ start: 0, end: 1 }],
      regions: []
    } as unknown as VectorNetwork
    const result = normalizeVectorNetwork(network)
    expect(result.segments[0].tangentStart).toEqual({ x: 0, y: 0 })
    expect(result.segments[0].tangentEnd).toEqual({ x: 0, y: 0 })
  })

  test('defaults only the missing tangent', () => {
    const network = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 3, y: 4 } }],
      regions: []
    } as unknown as VectorNetwork
    const result = normalizeVectorNetwork(network)
    expect(result.segments[0].tangentStart).toEqual({ x: 3, y: 4 })
    expect(result.segments[0].tangentEnd).toEqual({ x: 0, y: 0 })
  })

  test('normalized network survives encode/decode round-trip', () => {
    const raw = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'NONE' },
        { x: 80, y: 0, handleMirroring: 'NONE' },
        { x: 40, y: 80, handleMirroring: 'NONE' }
      ],
      segments: [
        { start: 0, end: 1 },
        { start: 1, end: 2 },
        { start: 2, end: 0 }
      ],
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
    } as unknown as VectorNetwork

    const normalized = normalizeVectorNetwork(raw)
    const blob = encodeVectorNetworkBlob(normalized)
    const decoded = decodeVectorNetworkBlob(blob)

    expect(decoded.vertices).toHaveLength(3)
    expect(decoded.segments).toHaveLength(3)
    for (const seg of decoded.segments) {
      expect(seg.tangentStart).toEqual({ x: 0, y: 0 })
      expect(seg.tangentEnd).toEqual({ x: 0, y: 0 })
    }
    expect(decoded.regions[0].loops).toEqual([[0, 1, 2]])
  })
})

describe('validateVectorNetwork', () => {
  test('valid network returns no errors', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    }
    expect(validateVectorNetwork(network)).toEqual([])
  })

  test('segments without tangents are valid (normalize handles them)', () => {
    const network = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ],
      segments: [{ start: 0, end: 1 }],
      regions: []
    } as unknown as VectorNetwork
    expect(validateVectorNetwork(network)).toEqual([])
  })

  test('rejects segment with out-of-range start index', () => {
    const network = {
      vertices: [{ x: 0, y: 0 }],
      segments: [{ start: 0, end: 5 }],
      regions: []
    } as unknown as VectorNetwork
    const errors = validateVectorNetwork(network)
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('end index 5 out of range')
  })

  test('rejects missing vertices array', () => {
    const network = { segments: [], regions: [] } as unknown as VectorNetwork
    const errors = validateVectorNetwork(network)
    expect(errors[0]).toContain('vertices must be an array')
  })

  test('rejects vertex with non-number coordinates', () => {
    const network = {
      vertices: [{ x: 'a', y: 0 }],
      segments: [],
      regions: []
    } as unknown as VectorNetwork
    const errors = validateVectorNetwork(network)
    expect(errors[0]).toContain('x and y must be numbers')
  })
})

describe('computeVectorBounds', () => {
  test('empty network', () => {
    expect(computeVectorBounds({ vertices: [], segments: [], regions: [] })).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0
    })
  })

  test('single vertex', () => {
    const bounds = computeVectorBounds({
      vertices: [{ x: 50, y: 30, handleMirroring: 'NONE' }],
      segments: [],
      regions: []
    })
    expect(bounds.x).toBe(50)
    expect(bounds.y).toBe(30)
    expect(bounds.width).toBe(0)
    expect(bounds.height).toBe(0)
  })

  test('two vertices', () => {
    const bounds = computeVectorBounds({
      vertices: [
        { x: 0, y: 0, handleMirroring: 'NONE' },
        { x: 100, y: 50, handleMirroring: 'NONE' }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    })
    expect(bounds).toEqual({ x: 0, y: 0, width: 100, height: 50 })
  })

  test('bezier curve extrema extend bounds', () => {
    const bounds = computeVectorBounds({
      vertices: [
        { x: 0, y: 0, handleMirroring: 'NONE' },
        { x: 100, y: 0, handleMirroring: 'NONE' }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: -50 }, tangentEnd: { x: 0, y: 50 } }],
      regions: []
    })
    // Curve extrema at t=(3±√3)/6, not at control points
    expect(bounds.y).toBeCloseTo(-14.4338, 3)
    expect(bounds.height).toBeCloseTo(28.8675, 3)
  })
})
