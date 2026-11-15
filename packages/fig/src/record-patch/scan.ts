import { inflateSync } from 'fflate'

import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import {
  ByteBuffer,
  compileSchema,
  decodeBinarySchema,
  type CompiledDefinition,
  type RuntimeCodec
} from '@open-pencil/kiwi/schema-runtime'

import { readFigArchiveParts } from '../archive'
import { guidKey, type RecordEntry } from './entry'

type RecordHead = Omit<RecordEntry<Uint8Array>, 'value'> & {
  guid?: GUID
  /** Read only when asked for: what an instance shows, for finding where components are used. */
  symbolData?: unknown
}
export type EncodedPart =
  | { kind: 'bytes'; bytes: Uint8Array }
  | { kind: 'records' | 'blobs'; fieldId: number; type: string }

/** The encoded message's fields in order, with its records and blobs located by byte range. */
export interface ScannedMessage {
  parts: EncodedPart[]
  records: Array<RecordHead & { value: Uint8Array }>
  blobs: Uint8Array[]
  hasBlobs: boolean
}

/** Reads a record's identity, place and type, and moves past everything else in it. */
function scanRecord(
  codec: RuntimeCodec,
  record: CompiledDefinition,
  bb: ByteBuffer,
  readSymbolData: boolean
): RecordHead {
  const { schema } = codec
  const head: RecordHead = {
    id: undefined,
    parent: undefined,
    type: undefined,
    parentIndex: undefined
  }
  for (let id = bb.readVarUint(); id !== 0; id = bb.readVarUint()) {
    const field = record.byId[id]
    if (!field) throw new Error('Attempted to parse invalid message')
    const name = field.isArray ? '' : field.name
    if (name === 'guid') {
      head.guid = schema.read(field, bb) as GUID
      head.id = guidKey(head.guid)
    } else if (name === 'parentIndex') {
      const parentIndex = schema.read(field, bb) as NodeChange['parentIndex']
      head.parentIndex = parentIndex
      head.parent = guidKey(parentIndex?.guid)
    } else if (name === 'type') {
      head.type = field.definition?.names[bb.readVarUint()]
    } else if (name === 'symbolData' && readSymbolData) head.symbolData = schema.read(field, bb)
    else schema.skip(field, bb)
  }
  return head
}

/** Locate an encoded message's records and blobs; `readSymbolData` also reads what instances show. */
export function scanMessage(
  codec: RuntimeCodec,
  data: Uint8Array,
  readSymbolData = false
): ScannedMessage {
  const { schema } = codec
  const fields = schema.definition('Message').byId
  const bb = new ByteBuffer(data)
  const scanned: ScannedMessage = { parts: [], records: [], blobs: [], hasBlobs: false }
  for (;;) {
    const start = bb.offset
    const id = bb.readVarUint()
    if (id === 0) break
    const field = fields[id]
    if (!field) throw new Error('Attempted to parse invalid message')
    const isRecords = field.name === 'nodeChanges' && field.isArray
    const isBlobs = field.name === 'blobs' && field.isArray
    if (!isRecords && !isBlobs) {
      schema.skip(field, bb)
      scanned.parts.push({ kind: 'bytes', bytes: data.subarray(start, bb.offset) })
      continue
    }
    const definition = field.definition
    if (!definition) throw new Error(`Kiwi ${field.name} holds no messages`)
    const type = definition.name
    const element = { ...field, isArray: false }
    for (let count = bb.readVarUint(); count > 0; count--) {
      const begin = bb.offset
      if (isRecords) {
        const head = scanRecord(codec, definition, bb, readSymbolData)
        scanned.records.push({ ...head, value: data.subarray(begin, bb.offset) })
      } else {
        schema.skip(element, bb)
        scanned.blobs.push(data.subarray(begin, bb.offset))
      }
    }
    scanned.hasBlobs ||= isBlobs
    scanned.parts.push({ kind: isRecords ? 'records' : 'blobs', fieldId: id, type })
  }
  if (scanned.records.length === 0) throw new Error('No nodes found in .fig file')
  return scanned
}

/** The runtime codec of an archive's own schema. */
export function archiveCodec(schemaDeflated: Uint8Array): RuntimeCodec {
  return compileSchema(decodeBinarySchema(new ByteBuffer(inflateSync(schemaDeflated))))
}

/** An encoded archive's records with only the fields the page lookups read. */
export function scannedRecords(bytes: ArrayBuffer): NodeChange[] {
  const parts = readFigArchiveParts(bytes)
  const codec = archiveCodec(parts.schemaDeflated)
  const scanned = scanMessage(codec, parts.dataRaw, true)
  return scanned.records.map(
    (entry) =>
      ({
        guid: entry.guid,
        parentIndex: entry.parentIndex,
        type: entry.type,
        symbolData: entry.symbolData
      }) as NodeChange
  )
}
