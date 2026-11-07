import { inflateSync } from 'fflate'

import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import {
  ByteBuffer,
  compileSchema,
  decodeBinarySchema,
  type CompiledDefinition,
  type RuntimeCodec,
  type RuntimeMessage
} from '@open-pencil/kiwi/schema-runtime'

export function key(guid: GUID | undefined): string | undefined {
  return guid ? guidToString(guid) : undefined
}

/**
 * A record as merging sees it: its identity, place and type, with its contents either the bytes
 * the archive holds or a record to encode.
 */
export interface RecordEntry<Value> {
  id: string | undefined
  parent: string | undefined
  type: string | undefined
  parentIndex: NodeChange['parentIndex']
  value: Value
}

type RecordHead = Omit<RecordEntry<Uint8Array>, 'value'> & {
  guid?: GUID
  /** Read only when asked for: what an instance shows, for finding where components are used. */
  symbolData?: unknown
}
type EncodedPart =
  | { kind: 'bytes'; bytes: Uint8Array }
  | { kind: 'records' | 'blobs'; fieldId: number; type: string }

/** The encoded message's fields in order, with its records and blobs located by byte range. */
interface ScannedMessage {
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
      head.id = key(head.guid)
    } else if (name === 'parentIndex') {
      const parentIndex = schema.read(field, bb) as NodeChange['parentIndex']
      head.parentIndex = parentIndex
      head.parent = key(parentIndex?.guid)
    } else if (name === 'type') {
      head.type = field.definition?.names[bb.readVarUint()]
    } else if (name === 'symbolData' && readSymbolData) head.symbolData = schema.read(field, bb)
    else schema.skip(field, bb)
  }
  return head
}

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

export function archiveCodec(schemaDeflated: Uint8Array): RuntimeCodec {
  return compileSchema(decodeBinarySchema(new ByteBuffer(inflateSync(schemaDeflated))))
}

export function varUint(value: number): Uint8Array {
  const bb = new ByteBuffer()
  bb.writeVarUint(value)
  return bb.toUint8Array().slice()
}

export function encoded(codec: RuntimeCodec, type: string, value: unknown): Uint8Array {
  const bb = new ByteBuffer()
  codec.schema.encode(codec.schema.definition(type), value as RuntimeMessage, bb)
  return bb.toUint8Array().slice()
}

export function concat(chunks: readonly Uint8Array[]): Uint8Array {
  let length = 0
  for (const chunk of chunks) length += chunk.byteLength
  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}
