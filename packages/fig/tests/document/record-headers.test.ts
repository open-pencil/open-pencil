import { expect, test } from 'bun:test'

import { readFixtureArrayBuffer } from '#fig-tests/helpers/fig-fixtures'
import { parseFigBuffer, writeFigArchive } from '#fig/archive'
import { materializeDocument, materializeFigArchive } from '#fig/document/materialize'
import {
  createArchiveDocumentReader,
  createDocumentReader,
  RECORD_HEADER_FIELDS
} from '#fig/document/read'
import { deflateSync } from 'fflate'

import {
  createNodeChangesMessage,
  encodeMessage,
  getSchemaBytes,
  initCodec,
  type NodeChange
} from '@open-pencil/kiwi/fig/codec'
import { deduplicateNodeChangePluginData } from '@open-pencil/kiwi/fig/parse'
import { decodeWhole } from '@open-pencil/kiwi/schema-runtime'
import { setIdSession, type SceneGraph } from '@open-pencil/scene-graph'

const FIXTURE = 'gold-preview.fig'

/** A session no Figma file's GUIDs use, so the IDs this test mints stand apart from theirs. */
const TEST_SESSION = 7_777

/**
 * A document's layers as JSON with every ID this test minted renamed by first appearance: IDs
 * come from one process-wide counter, so two documents built in turn differ only in them.
 */
function canonical(graph: SceneGraph): string {
  const json = JSON.stringify([...graph.nodes.values()], (_key, value: unknown) => {
    if (value instanceof Map) return [...value]
    if (value instanceof Set) return [...value]
    if (value instanceof Uint8Array) return [...value]
    return value
  })
  const order = new Map<string, number>()
  return json.replace(new RegExp(`"${TEST_SESSION}:\\d+"`, 'g'), (id) => {
    if (!order.has(id)) order.set(id, order.size)
    return `"#${order.get(id)}"`
  })
}

test('record headers keep only their header fields and decode whole into the eager records', () => {
  const bytes = readFixtureArrayBuffer(FIXTURE)
  const eager = parseFigBuffer(bytes.slice(0)).nodeChanges
  const headers = parseFigBuffer(bytes.slice(0), undefined, {
    NodeChange: RECORD_HEADER_FIELDS
  }).nodeChanges
  const header = new Set<string>(RECORD_HEADER_FIELDS)

  expect(headers.flatMap(Object.keys).filter((field) => !header.has(field))).toEqual([])
  const whole = headers.map((record) => decodeWhole(record) as (typeof eager)[number])
  deduplicateNodeChangePluginData(whole)
  expect(whole).toEqual(eager)
})

// The archive reader keeps records as headers and decodes each whole when a read needs it; the
// document it builds must match one built from records decoded whole up front.
test('an archive reader with record headers builds the document records decoded whole build', () => {
  const bytes = readFixtureArrayBuffer(FIXTURE)
  const parsed = parseFigBuffer(bytes.slice(0))
  const options = { derivedBounds: true, onUnresolvedProperty: () => undefined }

  setIdSession(TEST_SESSION)
  try {
    const whole = materializeDocument(parsed.nodeChanges, parsed.blobs, {
      ...options,
      images: new Map(parsed.images)
    })
    const lazy = materializeFigArchive(bytes.slice(0), options)

    expect(canonical(lazy.graph)).toBe(canonical(whole.graph))
  } finally {
    setIdSession(0)
  }
})

// A file whose layers each name the other as parent cannot be read; reading those records must
// fail as a document read whole fails, not by recursing until the stack runs out. The archive
// reader decodes a record when it is read, so no page reaching them lets the file open.
test('an archive reader rejects a cyclic parent chain as a document read whole does', async () => {
  await initCodec()
  const guid = (localID: number) => ({ sessionID: 0, localID })
  const under = (parent: number) => ({ guid: guid(parent), position: '!' })
  const records: NodeChange[] = [
    { guid: guid(0), type: 'DOCUMENT', phase: 'CREATED', name: 'Document' },
    { guid: guid(1), type: 'CANVAS', phase: 'CREATED', name: 'Page', parentIndex: under(0) },
    { guid: guid(2), type: 'FRAME', phase: 'CREATED', name: 'A', parentIndex: under(3) },
    { guid: guid(3), type: 'FRAME', phase: 'CREATED', name: 'B', parentIndex: under(2) }
  ]
  const bytes = writeFigArchive({
    schemaDeflated: deflateSync(getSchemaBytes()),
    kiwiData: encodeMessage(createNodeChangesMessage(0, 0, records)),
    thumbnailPNG: new Uint8Array([1]),
    metaJSON: '{}'
  })

  expect(() => createDocumentReader(records)).toThrow('Cyclic component-property ancestry')
  const { reader } = createArchiveDocumentReader(bytes.slice().buffer)
  expect(() => reader.sourceRecords).toThrow('Cyclic component-property ancestry')
})
