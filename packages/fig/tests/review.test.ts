import { beforeAll, describe, expect, test } from 'bun:test'

import { writeFigArchive } from '#fig/archive'
import { createFigReview, serializeFigReview } from '#fig/review'
import { deflateSync } from 'fflate'

import {
  initCodec,
  encodeMessage,
  createNodeChangesMessage,
  getSchemaBytes,
  type NodeChange
} from '@open-pencil/kiwi/fig/codec'

const a: NodeChange = {
  guid: { sessionID: 2, localID: 1 },
  type: 'RECTANGLE',
  name: 'A',
  size: { x: 20, y: 30 }
}
const b: NodeChange = { guid: { sessionID: 3, localID: 1 }, type: 'RECTANGLE', name: 'B' }
const emptyResources = { blobs: [], images: [] }

describe('FIG review snapshots', () => {
  beforeAll(initCodec)

  test('sorts records, nested keys and images independently of insertion order', () => {
    const first = serializeFigReview({
      nodeChanges: [a, b],
      blobs: [],
      images: [
        ['z', new Uint8Array([1])],
        ['a', new Uint8Array([2])]
      ]
    })
    const second = serializeFigReview({
      nodeChanges: [
        b,
        { name: 'A', size: { y: 30, x: 20 }, type: 'RECTANGLE', guid: { localID: 1, sessionID: 2 } }
      ],
      blobs: [],
      images: [
        ['a', new Uint8Array([2])],
        ['z', new Uint8Array([1])]
      ]
    })
    expect(second).toBe(first)
    expect(first).toContain('"images": {"a":"Ag==","z":"AQ=="}')
  })

  test('uses saved GUIDs and ignores timestamps, thumbnails and ZIP packing', () => {
    const archive = (timestamp: string, thumbnail: number) =>
      writeFigArchive({
        schemaDeflated: deflateSync(getSchemaBytes()),
        kiwiData: encodeMessage(createNodeChangesMessage(0, 0, [a, b])),
        thumbnailPNG: new Uint8Array([thumbnail]),
        metaJSON: JSON.stringify({ createdAt: timestamp })
      })
    const first = archive('2026-01-01', 1)
    const second = archive('2026-01-02', 2)
    expect(second).not.toEqual(first)
    expect(createFigReview(Uint8Array.from(second).buffer)).toBe(
      createFigReview(Uint8Array.from(first).buffer)
    )
  })

  test('a size edit changes only its record line', () => {
    const before = serializeFigReview({ ...emptyResources, nodeChanges: [a, b] }).split('\n')
    const after = serializeFigReview({
      ...emptyResources,
      nodeChanges: [{ ...a, size: { x: 21, y: 30 } }, b]
    }).split('\n')
    expect(after.filter((line, index) => line !== before[index])).toHaveLength(1)
  })

  test('preserves array order, indexed blobs and resource changes', () => {
    const record = { ...a, dashPattern: [1, 2] }
    const snapshot = serializeFigReview({
      nodeChanges: [record],
      blobs: [new Uint8Array([1]), new Uint8Array([2])],
      images: []
    })
    expect(
      serializeFigReview({
        nodeChanges: [{ ...record, dashPattern: [2, 1] }],
        blobs: [new Uint8Array([1]), new Uint8Array([2])],
        images: []
      })
    ).not.toBe(snapshot)
    expect(
      serializeFigReview({
        nodeChanges: [record],
        blobs: [new Uint8Array([2]), new Uint8Array([1])],
        images: []
      })
    ).not.toBe(snapshot)
  })

  test('normalizes negative zero and omits absent optional fields', () => {
    expect(
      serializeFigReview({
        ...emptyResources,
        nodeChanges: [{ ...a, opacity: -0, visible: undefined }]
      })
    ).toBe(serializeFigReview({ ...emptyResources, nodeChanges: [{ ...a, opacity: 0 }] }))
  })

  test('rejects missing/duplicate identities and non-finite values', () => {
    expect(() => serializeFigReview({ ...emptyResources, nodeChanges: [{}] })).toThrow(
      'without a GUID'
    )
    expect(() => serializeFigReview({ ...emptyResources, nodeChanges: [a, a] })).toThrow(
      'Duplicate FIG record GUID'
    )
    expect(() =>
      serializeFigReview({ ...emptyResources, nodeChanges: [{ ...a, opacity: Number.NaN }] })
    ).toThrow('non-finite')
    expect(() =>
      serializeFigReview({
        ...emptyResources,
        nodeChanges: [a],
        images: [
          ['x', new Uint8Array()],
          ['x', new Uint8Array()]
        ]
      })
    ).toThrow('Duplicate FIG image')
  })

  test('rejects cyclic fields and sparse arrays rather than emitting invalid JSON', () => {
    const size: { x: number; y: number; cycle?: object } = { x: 1, y: 2 }
    size.cycle = size
    expect(() => serializeFigReview({ ...emptyResources, nodeChanges: [{ ...a, size }] })).toThrow(
      'cycle'
    )
    const dashPattern: number[] = []
    dashPattern.length = 2
    expect(() =>
      serializeFigReview({
        ...emptyResources,
        nodeChanges: [{ ...a, dashPattern }]
      })
    ).toThrow('non-JSON value')
  })
})
