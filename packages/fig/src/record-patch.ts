import { inflateSync } from 'fflate'

import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import {
  ByteBuffer,
  compileSchema,
  createSchemaSkipper,
  decodeBinarySchema,
  type SchemaSkipper
} from '@open-pencil/kiwi/schema-runtime'
import { orderKeyBetween } from '@open-pencil/scene-graph/order-keys'

import { readFigArchiveParts, writeFigArchive, type FigImageEntry } from './archive'
import { symbolDataOf, symbolOverridesOf } from './instance-overrides/types'

/**
 * What an edited document changes in the archive it was opened from: the records to write, by
 * GUID, and the records to drop. Records nobody touched stay as the archive saved them.
 */
export interface FigRecordPatch {
  /** Written in place of the archive's record with the same GUID, or added after the rest. */
  records: NodeChange[]
  /** Blobs the records add; their indices continue after the archive's. */
  blobs: Uint8Array[]
  /** Dropped together with every record below them. */
  removed: GUID[]
  /** The records hold every variable and collection, so the archive's are dropped. */
  replaceVariables: boolean
}

/** Archive facts a patch is built against: where new blob indices and new GUIDs start. */
export interface FigArchiveRecordInfo {
  blobCount: number
  /** Above every local ID the archive uses with session 0 or 1, the sessions new GUIDs take. */
  nextLocalId: number
  imageHashes: string[]
  /** The document record's GUID, as `session:local`. */
  documentId: string | null
}

export interface FigPatchedArchiveInput {
  thumbnailPNG: Uint8Array
  metaJSON: string
  /** Images the archive does not hold yet. */
  images: FigImageEntry[]
}

const VARIABLE_TYPES = new Set(['VARIABLE', 'VARIABLE_SET'])

function key(guid: GUID | undefined): string | undefined {
  return guid ? guidToString(guid) : undefined
}

function isGuidLike(value: object): value is GUID {
  return (
    'sessionID' in value &&
    'localID' in value &&
    typeof value.sessionID === 'number' &&
    typeof value.localID === 'number'
  )
}

/** Every GUID an archive embeds, record identities and references alike. */
function highestLocalId(records: readonly NodeChange[]): number {
  let highest = 0
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }
    if (isGuidLike(value) && (value.sessionID === 0 || value.sessionID === 1))
      highest = Math.max(highest, value.localID)
    for (const item of Object.values(value)) visit(item)
  }
  visit(records)
  return highest
}

export function figArchiveRecordInfo(archive: {
  records: readonly NodeChange[]
  blobCount: number
  imageHashes: readonly string[]
}): FigArchiveRecordInfo {
  return {
    blobCount: archive.blobCount,
    nextLocalId: highestLocalId(archive.records) + 1,
    imageHashes: [...archive.imageHashes],
    documentId: key(archive.records.find((record) => record.type === 'DOCUMENT')?.guid) ?? null
  }
}

/**
 * A record as merging sees it: its identity, place and type, with its contents either the bytes
 * the archive holds or a record to encode.
 */
interface RecordEntry<Value> {
  id: string | undefined
  parent: string | undefined
  type: string | undefined
  parentIndex: NodeChange['parentIndex']
  value: Value
}

function entryOf(record: NodeChange): RecordEntry<NodeChange> {
  return {
    id: key(record.guid),
    parent: key(record.parentIndex?.guid),
    type: record.type,
    parentIndex: record.parentIndex,
    value: record
  }
}

const isVariable = (entry: { type: string | undefined }) =>
  !!entry.type && VARIABLE_TYPES.has(entry.type)

/** The removed records and those below them, except records the patch writes elsewhere. */
function removedRecords(
  records: ReadonlyArray<RecordEntry<unknown>>,
  roots: readonly GUID[],
  written: ReadonlySet<string>
): Set<string> {
  const children = new Map<string, string[]>()
  for (const record of records) {
    if (!record.id || !record.parent) continue
    const siblings = children.get(record.parent) ?? []
    siblings.push(record.id)
    children.set(record.parent, siblings)
  }
  const removed = new Set<string>()
  const pending = roots.map(guidToString)
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    if (removed.has(id) || written.has(id)) continue
    removed.add(id)
    for (const child of children.get(id) ?? []) pending.push(child)
  }
  return removed
}

/** Writes records in order, holding back one whose new parent has not been written yet. */
function createRecordWriter<Value>(
  written: ReadonlyMap<string, unknown>,
  archiveIds: ReadonlySet<string>
) {
  const result: Array<RecordEntry<Value>> = []
  const emitted = new Set<string>()
  const waiting = new Map<string, Array<RecordEntry<Value>>>()
  const isPending = (parent: string | undefined): parent is string =>
    !!parent && !emitted.has(parent) && written.has(parent) && !archiveIds.has(parent)
  const emit = (entry: RecordEntry<Value>): void => {
    if (isPending(entry.parent)) {
      waiting.set(entry.parent, [...(waiting.get(entry.parent) ?? []), entry])
      return
    }
    result.push(entry)
    if (!entry.id) return
    emitted.add(entry.id)
    const children = waiting.get(entry.id) ?? []
    waiting.delete(entry.id)
    for (const child of children) emit(child)
  }
  return {
    emit,
    emitted: (id: string) => emitted.has(id),
    finish(): Array<RecordEntry<Value>> {
      for (const children of waiting.values()) for (const child of children) result.push(child)
      return result
    }
  }
}

/** The last position under each parent among records that keep the position they have. */
function lastPositions(
  entries: ReadonlyArray<RecordEntry<unknown>>,
  archivePositions: ReadonlyMap<string, NodeChange['parentIndex']>
): Map<string, string> {
  const last = new Map<string, string>()
  for (const entry of entries) {
    const position = entry.parentIndex?.position
    const moves = isVariable(entry) && !(entry.id && archivePositions.has(entry.id))
    if (!entry.parent || !position || moves) continue
    if (position > (last.get(entry.parent) ?? '')) last.set(entry.parent, position)
  }
  return last
}

/**
 * Variables return to the places they had; new ones go after their canvas's last child, so no
 * position is shared with the styles and variables the archive keeps there.
 */
function placeVariableRecords(
  entries: ReadonlyArray<RecordEntry<unknown>>,
  archivePositions: ReadonlyMap<string, NodeChange['parentIndex']>
): void {
  const last = lastPositions(entries, archivePositions)
  for (const entry of entries) {
    if (!isVariable(entry) || entry.value instanceof Uint8Array) continue
    const record = entry.value as NodeChange
    const kept = entry.id ? archivePositions.get(entry.id) : undefined
    if (kept) record.parentIndex = structuredClone(kept)
    else if (entry.parent && record.parentIndex) {
      const position = orderKeyBetween(last.get(entry.parent) ?? null, null)
      record.parentIndex = { ...record.parentIndex, position }
      last.set(entry.parent, position)
    }
  }
}

/**
 * Merge a patch into the archive's records. Untouched records keep their place; a written
 * record takes its archive record's, and one whose parent is new follows that parent.
 */
function mergeRecords<Value>(
  archive: ReadonlyArray<RecordEntry<Value>>,
  patch: Pick<FigRecordPatch, 'records' | 'removed' | 'replaceVariables'>
): Array<RecordEntry<Value | NodeChange>> {
  const written = new Map<string, RecordEntry<NodeChange>>()
  for (const record of patch.records) {
    const entry = entryOf(record)
    if (entry.id) written.set(entry.id, entry)
  }
  const removed = removedRecords(archive, patch.removed, new Set(written.keys()))
  const archiveIds = new Set(archive.flatMap((entry) => entry.id ?? []))
  const archivePositions = new Map<string, NodeChange['parentIndex']>()
  const writer = createRecordWriter<Value | NodeChange>(written, archiveIds)

  for (const entry of archive) {
    if (entry.id && removed.has(entry.id)) continue
    const replacement = entry.id ? written.get(entry.id) : undefined
    if (patch.replaceVariables && isVariable(entry)) {
      // A variable the records still hold takes its old place; one they dropped is gone.
      if (entry.id) archivePositions.set(entry.id, entry.parentIndex)
      if (replacement) writer.emit(replacement)
      continue
    }
    writer.emit(replacement ?? entry)
  }
  for (const entry of written.values())
    if (entry.id && !writer.emitted(entry.id) && !archiveIds.has(entry.id)) writer.emit(entry)
  const result = writer.finish()
  if (patch.replaceVariables) placeVariableRecords(result, archivePositions)
  return result
}

/** Merge a patch into decoded archive records. */
export function patchFigRecords(
  archive: readonly NodeChange[],
  patch: Pick<FigRecordPatch, 'records' | 'removed' | 'replaceVariables'>
): NodeChange[] {
  return mergeRecords(archive.map(entryOf), patch).map((entry) => entry.value)
}

type KiwiCodec = ReturnType<typeof compileSchema>
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

function fieldType(type: string | null): string {
  if (type === null) throw new Error('Kiwi field without a type')
  return type
}

function decoderOf(codec: KiwiCodec, type: string): (bb: ByteBuffer) => unknown {
  const decoder = codec[`decode${type}`]
  if (typeof decoder !== 'function') throw new Error(`No Kiwi decoder for ${type}`)
  return decoder as (bb: ByteBuffer) => unknown
}

/** Reads a record's identity, place and type, and moves past everything else in it. */
function scanRecord(
  codec: KiwiCodec,
  skipper: SchemaSkipper,
  type: string,
  bb: ByteBuffer,
  readSymbolData: boolean
): RecordHead {
  const fields = skipper.fieldsById(type)
  const head: RecordHead = {
    id: undefined,
    parent: undefined,
    type: undefined,
    parentIndex: undefined
  }
  for (let id = bb.readVarUint(); id !== 0; id = bb.readVarUint()) {
    const field = fields.get(id)
    if (!field) throw new Error('Attempted to parse invalid message')
    const name = field.isArray ? '' : field.name
    if (name === 'guid') {
      head.guid = decoderOf(codec, fieldType(field.type))(bb) as GUID
      head.id = key(head.guid)
    } else if (name === 'parentIndex') {
      const parentIndex = decoderOf(codec, fieldType(field.type))(bb) as NodeChange['parentIndex']
      head.parentIndex = parentIndex
      head.parent = key(parentIndex?.guid)
    } else if (name === 'type') {
      const names = codec[fieldType(field.type)] as Record<number, string> | undefined
      head.type = names?.[bb.readVarUint()]
    } else if (name === 'symbolData' && readSymbolData)
      head.symbolData = decoderOf(codec, fieldType(field.type))(bb)
    else skipper.skipField(field, bb)
  }
  return head
}

function scanMessage(
  codec: KiwiCodec,
  skipper: SchemaSkipper,
  data: Uint8Array,
  readSymbolData = false
): ScannedMessage {
  const fields = skipper.fieldsById('Message')
  const bb = new ByteBuffer(data)
  const scanned: ScannedMessage = { parts: [], records: [], blobs: [], hasBlobs: false }
  for (;;) {
    const start = bb.offset
    const id = bb.readVarUint()
    if (id === 0) break
    const field = fields.get(id)
    if (!field) throw new Error('Attempted to parse invalid message')
    const type = fieldType(field.type)
    const isRecords = field.name === 'nodeChanges' && field.isArray
    const isBlobs = field.name === 'blobs' && field.isArray
    if (!isRecords && !isBlobs) {
      skipper.skipField(field, bb)
      scanned.parts.push({ kind: 'bytes', bytes: data.subarray(start, bb.offset) })
      continue
    }
    for (let count = bb.readVarUint(); count > 0; count--) {
      const begin = bb.offset
      if (isRecords) {
        const head = scanRecord(codec, skipper, type, bb, readSymbolData)
        scanned.records.push({ ...head, value: data.subarray(begin, bb.offset) })
      } else {
        skipper.skipValue(type, bb)
        scanned.blobs.push(data.subarray(begin, bb.offset))
      }
    }
    scanned.hasBlobs ||= isBlobs
    scanned.parts.push({ kind: isRecords ? 'records' : 'blobs', fieldId: id, type })
  }
  if (scanned.records.length === 0) throw new Error('No nodes found in .fig file')
  return scanned
}

function archiveCodec(schemaDeflated: Uint8Array) {
  const schema = decodeBinarySchema(new ByteBuffer(inflateSync(schemaDeflated)))
  return { codec: compileSchema(schema), skipper: createSchemaSkipper(schema) }
}

function varUint(value: number): Uint8Array {
  const bb = new ByteBuffer()
  bb.writeVarUint(value)
  return bb.toUint8Array().slice()
}

function encoded(codec: KiwiCodec, type: string, value: unknown): Uint8Array {
  const encoder = codec[`encode${type}`]
  if (typeof encoder !== 'function') throw new Error(`No Kiwi encoder for ${type}`)
  const bytes = (encoder as (message: unknown) => Uint8Array | undefined)(value)
  if (!bytes) throw new Error(`Encoding ${type} produced nothing`)
  return bytes.slice()
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
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

/**
 * The archive's message with the patch applied. Untouched records and blobs are copied as the
 * bytes they are and only written records are encoded, so the cost follows the edit.
 */
export function patchFigMessage(
  schemaDeflated: Uint8Array,
  dataRaw: Uint8Array,
  patch: FigRecordPatch
): Uint8Array {
  const { codec, skipper } = archiveCodec(schemaDeflated)
  const scanned = scanMessage(codec, skipper, dataRaw)
  const merged = mergeRecords(scanned.records, patch)
  const blobs = (type: string) => [
    ...scanned.blobs,
    ...patch.blobs.map((bytes) => encoded(codec, type, { bytes }))
  ]
  // Appended one by one: a document's records are far more than a call can take as arguments.
  const chunks: Uint8Array[] = []
  const appendField = (fieldId: number, values: readonly Uint8Array[]) => {
    chunks.push(varUint(fieldId), varUint(values.length))
    for (const value of values) chunks.push(value)
  }
  for (const part of scanned.parts) {
    if (part.kind === 'bytes') chunks.push(part.bytes)
    else if (part.kind === 'blobs') appendField(part.fieldId, blobs(part.type))
    else
      appendField(
        part.fieldId,
        merged.map((entry) =>
          entry.value instanceof Uint8Array ? entry.value : encoded(codec, part.type, entry.value)
        )
      )
  }
  if (!scanned.hasBlobs && patch.blobs.length > 0) {
    const field = skipper.definition('Message').fields.find((entry) => entry.name === 'blobs')
    if (!field) throw new Error('The archive schema has no blobs')
    appendField(field.value, blobs(fieldType(field.type)))
  }
  chunks.push(varUint(0))
  return concat(chunks)
}

/** Write the archive with the patch applied, in the archive's own schema. */
export function patchFigArchive(
  bytes: ArrayBuffer,
  patch: FigRecordPatch,
  input: FigPatchedArchiveInput
): Uint8Array {
  const parts = readFigArchiveParts(bytes)
  const kiwiData = patchFigMessage(parts.schemaDeflated, parts.dataRaw, patch)
  const archiveImages = new Set(parts.images.map(([hash]) => hash))
  return writeFigArchive({
    schemaDeflated: parts.schemaDeflated,
    kiwiData,
    thumbnailPNG: input.thumbnailPNG,
    metaJSON: input.metaJSON,
    images: [
      ...parts.images.map(([name, data]) => ({ name: `images/${name}`, data })),
      ...input.images.filter((image) => !archiveImages.has(image.name.replace(/^images\//, '')))
    ],
    figKiwiVersion: parts.figKiwiVersion
  })
}

/**
 * The pages whose instances use these components, directly or through a component that nests
 * one of them. Their records carry overrides and sizes derived from the components.
 */
export function figComponentUsePages(
  records: readonly NodeChange[],
  componentIds: readonly string[]
): string[] {
  const byId = new Map<string, NodeChange>()
  const instancesOf = new Map<string, string[]>()
  const use = (componentId: string | undefined, instanceId: string) => {
    if (!componentId) return
    const instances = instancesOf.get(componentId) ?? []
    instances.push(instanceId)
    instancesOf.set(componentId, instances)
  }
  for (const record of records) {
    const id = key(record.guid)
    if (!id) continue
    byId.set(id, record)
    if (record.type !== 'INSTANCE') continue
    use(key(symbolDataOf(record)?.symbolID), id)
    for (const override of symbolOverridesOf(record)) use(key(override.overriddenSymbolID), id)
  }
  const nearest = (id: string, type: string): string | undefined => {
    const seen = new Set<string>()
    for (let current = byId.get(id); current;) {
      const currentId = key(current.guid)
      if (!currentId || seen.has(currentId)) return undefined
      seen.add(currentId)
      if (current.type === type) return currentId
      const parent = key(current.parentIndex?.guid)
      current = parent ? byId.get(parent) : undefined
    }
    return undefined
  }
  const pages = new Set<string>()
  const visited = new Set<string>()
  const pending = [...componentIds]
  for (let componentId = pending.pop(); componentId !== undefined; componentId = pending.pop()) {
    if (visited.has(componentId)) continue
    visited.add(componentId)
    for (const instanceId of instancesOf.get(componentId) ?? []) {
      const page = nearest(instanceId, 'CANVAS')
      if (page) pages.add(page)
      const owner = nearest(instanceId, 'SYMBOL')
      if (owner) pending.push(owner)
    }
  }
  return [...pages]
}

/** `figComponentUsePages` over an encoded archive, reading only what it needs of each record. */
export function figArchiveComponentUsePages(
  bytes: ArrayBuffer,
  componentIds: readonly string[]
): string[] {
  const parts = readFigArchiveParts(bytes)
  const { codec, skipper } = archiveCodec(parts.schemaDeflated)
  const scanned = scanMessage(codec, skipper, parts.dataRaw, true)
  const records = scanned.records.map(
    (entry) =>
      ({
        guid: entry.guid,
        parentIndex: entry.parentIndex,
        type: entry.type,
        symbolData: entry.symbolData
      }) as NodeChange
  )
  return figComponentUsePages(records, componentIds)
}
