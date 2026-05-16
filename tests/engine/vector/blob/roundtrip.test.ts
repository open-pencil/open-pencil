import { describe, test, expect } from 'bun:test'

import { encodeVectorNetworkBlob, decodeVectorNetworkBlob, type VectorNetwork } from '@open-pencil/core'

import {
  lineNetwork,
  triangleNetwork,
  vectorNetwork,
  vectorSegment,
  vectorVertex
} from '#tests/helpers/vector-network'

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

