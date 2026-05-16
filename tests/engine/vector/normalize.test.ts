import { describe, test, expect } from 'bun:test'

import { decodeVectorNetworkBlob, encodeVectorNetworkBlob, normalizeVectorNetwork, type VectorNetwork } from '@open-pencil/core'

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
    } as VectorNetwork
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
    } as VectorNetwork
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
    } as VectorNetwork

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

