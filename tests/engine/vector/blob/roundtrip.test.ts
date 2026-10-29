import { describe, test, expect } from 'bun:test'

import {
  buildStyleOverrideTable,
  encodeVectorNetworkBlob,
  decodeVectorNetworkBlob,
  textPathStartSegment
} from '@open-pencil/fig/node-change'
import type { VectorNetwork } from '@open-pencil/scene-graph'

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

describe('vertex stroke caps in the style override table', () => {
  test('a per-vertex arrow cap round-trips', () => {
    const network = vectorNetwork(
      [{ ...vectorVertex(0, 0), strokeCap: 'ARROW_EQUILATERAL' }, vectorVertex(100, 0)],
      [vectorSegment(0, 1)]
    )
    const { table, styleToId } = buildStyleOverrideTable(network)
    const blob = encodeVectorNetworkBlob(network, styleToId)
    const decoded = decodeVectorNetworkBlob(blob, table)
    expect(decoded.vertices[0].strokeCap).toBe('ARROW_EQUILATERAL')
    expect(decoded.vertices[1].strokeCap).toBeUndefined()
  })

  test('stroke cap and handle mirroring survive together on one vertex', () => {
    const network = vectorNetwork(
      [
        { ...vectorVertex(0, 0), strokeCap: 'ARROW_LINES', handleMirroring: 'ANGLE' },
        { ...vectorVertex(50, 50), handleMirroring: 'ANGLE' }
      ],
      [vectorSegment(0, 1, { x: 10, y: 0 }, { x: -10, y: 0 })]
    )
    const { table, styleToId } = buildStyleOverrideTable(network)
    const blob = encodeVectorNetworkBlob(network, styleToId)
    const decoded = decodeVectorNetworkBlob(blob, table)
    expect(decoded.vertices[0].strokeCap).toBe('ARROW_LINES')
    expect(decoded.vertices[0].handleMirroring).toBe('ANGLE')
    expect(decoded.vertices[1].strokeCap).toBeUndefined()
    expect(decoded.vertices[1].handleMirroring).toBe('ANGLE')
  })
})

describe('vertex corners in the style override table', () => {
  test('a per-vertex corner radius and join round-trip', () => {
    const network = vectorNetwork(
      [
        { ...vectorVertex(0, 0), cornerRadius: 8, strokeJoin: 'ROUND' },
        vectorVertex(100, 0),
        { ...vectorVertex(100, 100), cornerRadius: 4 }
      ],
      [vectorSegment(0, 1), vectorSegment(1, 2)]
    )
    const { table, styleToId } = buildStyleOverrideTable(network)
    const decoded = decodeVectorNetworkBlob(encodeVectorNetworkBlob(network, styleToId), table)
    expect(decoded.vertices.map((vertex) => vertex.cornerRadius)).toEqual([8, undefined, 4])
    expect(decoded.vertices[0].strokeJoin).toBe('ROUND')
  })

  test('an explicit zero radius survives, so a rounded layer keeps that point sharp', () => {
    const network = vectorNetwork(
      [{ ...vectorVertex(0, 0), cornerRadius: 0 }, vectorVertex(100, 0), vectorVertex(100, 100)],
      [vectorSegment(0, 1), vectorSegment(1, 2)]
    )
    const { table, styleToId } = buildStyleOverrideTable(network)
    expect(table).toEqual([{ styleID: 1, cornerRadius: 0 }])
    const decoded = decodeVectorNetworkBlob(encodeVectorNetworkBlob(network, styleToId), table)
    expect(decoded.vertices.map((vertex) => vertex.cornerRadius)).toEqual([0, undefined, undefined])
  })
})

describe('region style words', () => {
  /** A one-region triangle blob whose region word is `word`. */
  function regionBlob(word: number) {
    const blob = encodeVectorNetworkBlob(triangleNetwork())
    const view = new DataView(blob.buffer)
    // Header 12 bytes, three 12-byte vertices and three 28-byte segments come before the region.
    view.setUint32(12 + 3 * 12 + 3 * 28, word, true)
    return blob
  }

  test('the winding rule is the low bit, under the region’s style ID', () => {
    // Style 3 with even-odd winding, then with nonzero winding. Every styled region in the fixtures
    // is nonzero, so the even-odd case follows the bit layout rather than a Figma file.
    expect(decodeVectorNetworkBlob(regionBlob((3 << 1) | 0)).regions[0].windingRule).toBe('EVENODD')
    expect(decodeVectorNetworkBlob(regionBlob((3 << 1) | 1)).regions[0].windingRule).toBe('NONZERO')
  })
})

describe('the text path start segment', () => {
  test('is the segment Figma marks with style word 0x1ffffff, else the first', () => {
    const network = vectorNetwork(
      [vectorVertex(0, 0), vectorVertex(100, 0), vectorVertex(100, 100)],
      [vectorSegment(0, 1), vectorSegment(1, 2)]
    )
    const blob = encodeVectorNetworkBlob(network)
    expect(textPathStartSegment(blob)).toBe(0)
    // Header 12 bytes and three 12-byte vertices come before the 28-byte segments.
    new DataView(blob.buffer).setUint32(12 + 3 * 12 + 28, 0x1ffffff, true)
    expect(textPathStartSegment(blob)).toBe(1)
    // The marker is a style word, so the network itself decodes unchanged.
    expect(decodeVectorNetworkBlob(blob)).toEqual(
      decodeVectorNetworkBlob(encodeVectorNetworkBlob(network))
    )
  })
})
