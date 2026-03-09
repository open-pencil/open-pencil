import { describe, test, expect } from 'bun:test'

import {
  encodeVectorNetworkBlob,
  decodeVectorNetworkBlob,
  computeVectorBounds,
  type VectorNetwork,
} from '@open-pencil/core'

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
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'NONE' },
        { x: 100, y: 50, handleMirroring: 'NONE' }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: []
    }
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
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'ANGLE' },
        { x: 100, y: 100, handleMirroring: 'ANGLE' }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 30, y: 0 }, tangentEnd: { x: -30, y: 0 } }
      ],
      regions: []
    }
    const blob = encodeVectorNetworkBlob(network)
    const decoded = decodeVectorNetworkBlob(blob)
    expect(decoded.segments[0].tangentStart.x).toBeCloseTo(30)
    expect(decoded.segments[0].tangentEnd.x).toBeCloseTo(-30)
  })

  test('network with region', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'NONE' },
        { x: 100, y: 0, handleMirroring: 'NONE' },
        { x: 50, y: 100, handleMirroring: 'NONE' }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: [
        { windingRule: 'NONZERO', loops: [[0, 1, 2]] }
      ]
    }
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
      regions: [
        { windingRule: 'EVENODD', loops: [[0, 1, 2, 3]] }
      ]
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

describe('computeVectorBounds', () => {
  test('empty network', () => {
    expect(computeVectorBounds({ vertices: [], segments: [], regions: [] })).toEqual({
      x: 0, y: 0, width: 0, height: 0
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

  test('bezier control points extend bounds', () => {
    const bounds = computeVectorBounds({
      vertices: [
        { x: 0, y: 0, handleMirroring: 'NONE' },
        { x: 100, y: 0, handleMirroring: 'NONE' }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: -50 }, tangentEnd: { x: 0, y: 50 } }
      ],
      regions: []
    })
    expect(bounds.y).toBe(-50)
    expect(bounds.height).toBe(100)
  })
})
