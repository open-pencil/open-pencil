import { beforeAll, describe, expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { figComponentUsePages, patchFigMessage, patchFigRecords } from '#fig/record-patch'
import { deflateSync } from 'fflate'

import {
  getCompiledSchema,
  getSchemaBytes,
  initCodec,
  type NodeChange
} from '@open-pencil/kiwi/fig/codec'

const record = (localID: number, parent: number | null, extra: Partial<NodeChange> = {}) =>
  ({
    guid: guid(localID),
    ...(parent === null ? {} : { parentIndex: { guid: guid(parent), position: `${localID}` } }),
    type: 'FRAME',
    ...extra
  }) as NodeChange

const ids = (records: readonly NodeChange[]) => records.map((change) => change.guid?.localID)

describe('patching archive records', () => {
  const archive = [
    record(0, null, { type: 'DOCUMENT' }),
    record(1, 0, { type: 'CANVAS' }),
    record(2, 1),
    record(3, 2),
    record(4, 2),
    record(5, 1)
  ]

  test('keeps untouched records and writes a changed one in its place', () => {
    const renamed = record(3, 2, { name: 'Renamed' })
    const result = patchFigRecords(archive, {
      records: [renamed],
      removed: [],
      replaceVariables: false
    })
    expect(ids(result)).toEqual([0, 1, 2, 3, 4, 5])
    expect(result[3]).toBe(renamed)
    expect(result[4]).toBe(archive[4])
  })

  test('removes a record with those below it, but not one the patch moved out', () => {
    const moved = record(4, 1)
    const result = patchFigRecords(archive, {
      records: [moved],
      removed: [guid(2)],
      replaceVariables: false
    })
    expect(ids(result)).toEqual([0, 1, 4, 5])
  })

  test('writes a record moved into a new layer after that layer', () => {
    const added = record(9, 1)
    const moved = record(5, 9)
    const result = patchFigRecords(archive, {
      records: [moved, added],
      removed: [],
      replaceVariables: false
    })
    expect(ids(result)).toEqual([0, 1, 2, 3, 4, 9, 5])
  })

  test('replaces variables, keeping the places of those that remain', () => {
    const variables = [
      record(6, 1, { type: 'VARIABLE_SET' }),
      record(7, 6, { type: 'VARIABLE' }),
      record(8, 6, { type: 'VARIABLE' })
    ]
    const result = patchFigRecords([...archive, ...variables], {
      records: [
        record(7, 6, { type: 'VARIABLE', name: 'Kept' }),
        record(9, 6, { type: 'VARIABLE' })
      ],
      removed: [],
      replaceVariables: true
    })
    expect(ids(result)).toEqual([0, 1, 2, 3, 4, 5, 7, 9])
    expect(result.find((change) => change.guid?.localID === 7)?.parentIndex?.position).toBe('7')
    const added = result.find((change) => change.guid?.localID === 9)?.parentIndex?.position ?? ''
    expect(added > '7').toBe(true)
  })
})

describe('pages using components', () => {
  test('follows instances through the components that nest them', () => {
    const records = [
      record(1, 0, { type: 'CANVAS' }),
      record(2, 0, { type: 'CANVAS' }),
      record(3, 0, { type: 'CANVAS' }),
      record(10, 1, { type: 'SYMBOL' }),
      record(11, 1, { type: 'SYMBOL' }),
      record(12, 11, { type: 'INSTANCE', symbolData: { symbolID: guid(10) } }),
      record(13, 2, { type: 'INSTANCE', symbolData: { symbolID: guid(11) } }),
      record(14, 3, { type: 'FRAME' })
    ]
    expect(figComponentUsePages(records, ['1:10']).toSorted()).toEqual(['1:1', '1:2'])
  })
})

describe('splicing an encoded message', () => {
  beforeAll(() => initCodec())

  test('decodes as merging the decoded records would, copying untouched records as bytes', () => {
    const codec = getCompiledSchema()
    const archive = [
      record(0, null, { type: 'DOCUMENT', name: 'Document' }),
      record(1, 0, { type: 'CANVAS', name: 'Page' }),
      record(2, 1, { name: 'Frame', opacity: 0.5 }),
      record(3, 2, { name: 'Kept' }),
      record(4, 2, { name: 'Renamed' })
    ]
    const message = {
      type: 'NODE_CHANGES',
      sessionID: 0,
      ackID: 0,
      nodeChanges: archive,
      blobs: [{ bytes: new Uint8Array([1, 2]) }]
    }
    const data = codec.encodeMessage(message)
    const patch = {
      records: [record(4, 2, { name: 'Renamed again' }), record(9, 2, { name: 'Added' })],
      blobs: [new Uint8Array([3])],
      removed: [guid(3)],
      replaceVariables: false
    }
    const spliced = codec.decodeMessage(
      patchFigMessage(deflateSync(getSchemaBytes()), data, patch)
    ) as typeof message
    const merged = codec.decodeMessage(
      codec.encodeMessage({
        ...message,
        nodeChanges: patchFigRecords(archive, patch),
        blobs: [...message.blobs, { bytes: new Uint8Array([3]) }]
      })
    )
    expect(spliced).toEqual(merged as typeof message)
    expect(spliced.nodeChanges.map((change) => change.name)).toEqual([
      'Document',
      'Page',
      'Frame',
      'Renamed again',
      'Added'
    ])
  })
})
