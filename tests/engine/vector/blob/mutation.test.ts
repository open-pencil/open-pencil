import { describe, test, expect } from 'bun:test'

import { decodeVectorNetworkBlob, encodeVectorNetworkBlob, type VectorNetwork } from '@open-pencil/core'

// ---------------------------------------------------------------------------
// vectorNetworkBlob — precision and handleMirroring round-trip
// ---------------------------------------------------------------------------

describe('vectorNetworkBlob — precision and mirroring', () => {
  test('negative coordinates round-trip exactly', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: -123.456, y: -78.9, handleMirroring: 'NONE' },
        { x: -0.001, y: -999.999, handleMirroring: 'NONE' }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    }
    const decoded = decodeVectorNetworkBlob(encodeVectorNetworkBlob(network))
    expect(decoded.vertices[0].x).toBeCloseTo(-123.456, 2)
    expect(decoded.vertices[0].y).toBeCloseTo(-78.9, 2)
    expect(decoded.vertices[1].y).toBeCloseTo(-999.999, 2)
  })

  // handleMirroring is not encoded in vectorNetworkBlob (TODO in vector.ts:133).
  // ANGLE and ANGLE_AND_LENGTH are decoded as NONE — document this known limitation.
  test('handleMirroring NONE round-trips; ANGLE decodes as NONE (known limitation)', () => {
    const noneNetwork: VectorNetwork = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'NONE' },
        { x: 10, y: 0, handleMirroring: 'NONE' }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    }
    const decodedNone = decodeVectorNetworkBlob(encodeVectorNetworkBlob(noneNetwork))
    expect(decodedNone.vertices[0].handleMirroring).toBe('NONE')

    // ANGLE is not persisted in blob — comes back as NONE
    const angleNetwork: VectorNetwork = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'ANGLE' },
        { x: 10, y: 0, handleMirroring: 'ANGLE' }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    }
    const decodedAngle = decodeVectorNetworkBlob(encodeVectorNetworkBlob(angleNetwork))
    // This is a known limitation: handleMirroring is not stored in the blob format
    expect(decodedAngle.vertices[0].handleMirroring).toBe('NONE')
  })

  test('large bezier tangents preserve sign', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'ANGLE' },
        { x: 500, y: 500, handleMirroring: 'ANGLE' }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: -200, y: 300 }, tangentEnd: { x: 150, y: -100 } }
      ],
      regions: []
    }
    const decoded = decodeVectorNetworkBlob(encodeVectorNetworkBlob(network))
    expect(decoded.segments[0].tangentStart.x).toBeCloseTo(-200, 1)
    expect(decoded.segments[0].tangentStart.y).toBeCloseTo(300, 1)
    expect(decoded.segments[0].tangentEnd.x).toBeCloseTo(150, 1)
    expect(decoded.segments[0].tangentEnd.y).toBeCloseTo(-100, 1)
  })

  test('many vertices preserve order and count', () => {
    const n = 20
    const vertices = Array.from({ length: n }, (_, i) => ({
      x: i * 10,
      y: i * 5,
      handleMirroring: 'NONE' as const
    }))
    const segments = Array.from({ length: n - 1 }, (_, i) => ({
      start: i,
      end: i + 1,
      tangentStart: { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 }
    }))
    const network: VectorNetwork = { vertices, segments, regions: [] }
    const decoded = decodeVectorNetworkBlob(encodeVectorNetworkBlob(network))
    expect(decoded.vertices).toHaveLength(n)
    expect(decoded.segments).toHaveLength(n - 1)
    for (let i = 0; i < n; i++) {
      expect(decoded.vertices[i].x).toBeCloseTo(i * 10, 1)
      expect(decoded.vertices[i].y).toBeCloseTo(i * 5, 1)
    }
  })

  test('encode produces deterministic output', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 10, y: 20, handleMirroring: 'NONE' },
        { x: 30, y: 40, handleMirroring: 'ANGLE' }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 5, y: 0 }, tangentEnd: { x: -5, y: 0 } }],
      regions: []
    }
    const a = encodeVectorNetworkBlob(network)
    const b = encodeVectorNetworkBlob(network)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })
})

