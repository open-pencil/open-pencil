import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import {
  buildFigKiwi,
  type FigDataCompressor,
  type FigFileKind
} from '@open-pencil/kiwi/fig/container'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { ByteBuffer } from '@open-pencil/kiwi/schema-runtime'
import { orderKeyBetween } from '@open-pencil/scene-graph/order-keys'

import { readFigArchiveParts, streamFigArchive, type FigImageEntry } from '../archive'
import { patchedRecord, type FigRecordFieldPatch } from './fields'
export {
  figArchiveComponentUsePages,
  figArchiveRecordPages,
  figComponentUsePages,
  figRecordPages
} from './pages'
import { archiveCodec, concat, encoded, key, scanMessage, varUint, type RecordEntry } from './scan'

export {
  entryPathKey,
  type FigEntryListPatch,
  type FigEntryPatch,
  type FigRecordFieldPatch
} from './fields'

/**
 * What an edited document changes in the archive it was opened from: the records to write, by
 * GUID, and the records to drop. Records nobody touched stay as the archive saved them.
 */
export interface FigRecordPatch {
  /** Written in place of the archive's record with the same GUID, or added after the rest. */
  records: NodeChange[]
  /** Changed fields of records the archive holds, merged into them. */
  fields?: FigRecordFieldPatch[]
  /** Blobs the records add; their indices continue after the archive's. */
  blobs: Uint8Array[]
  /** Dropped together with every record below them. */
  removed: GUID[]
  /** The records hold every variable and collection, so the archive's are dropped. */
  replaceVariables: boolean
}

/** Archive facts a patch is built against: where new blob indices and new GUIDs start. */
export interface FigArchiveRecordInfo {
  /** Record identities on every page, including pages not materialized in the graph. */
  recordIds: string[]
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
  /** The zstd level the document data is written at; the archive is read whatever it used. */
  compressionLevel?: number
  /** A design file or a FigJam board; the archive's own kind when omitted. */
  kind?: FigFileKind
}

const VARIABLE_TYPES = new Set(['VARIABLE', 'VARIABLE_SET'])

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
    recordIds: archive.records.flatMap((record) =>
      record.guid ? [guidToString(record.guid)] : []
    ),
    blobCount: archive.blobCount,
    nextLocalId: highestLocalId(archive.records) + 1,
    imageHashes: [...archive.imageHashes],
    documentId: key(archive.records.find((record) => record.type === 'DOCUMENT')?.guid) ?? null
  }
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
 * Add the archive records whose fields the patch changes to `written`, merged, and return the
 * records removed. A record an edit moved has left a removed parent; one it left in place goes
 * with it.
 */
function writeFieldPatches<Value>(
  archive: ReadonlyArray<RecordEntry<Value>>,
  patch: Pick<FigRecordPatch, 'fields' | 'removed'>,
  written: Map<string, RecordEntry<NodeChange>>,
  decode: (value: Value) => NodeChange
): Set<string> {
  const fields = new Map((patch.fields ?? []).map((entry) => [guidToString(entry.guid), entry]))
  const moved = [...fields].flatMap(([id, entry]) => ('parentIndex' in entry.set ? [id] : []))
  const removed = removedRecords(archive, patch.removed, new Set([...written.keys(), ...moved]))
  for (const entry of archive) {
    if (!entry.id || written.has(entry.id) || removed.has(entry.id)) continue
    const changed = fields.get(entry.id)
    if (changed) written.set(entry.id, entryOf(patchedRecord(decode(entry.value), changed)))
  }
  return removed
}

/**
 * Merge a patch into the archive's records. Untouched records keep their place; a written
 * record takes its archive record's, and one whose parent is new follows that parent.
 */
function mergeRecords<Value>(
  archive: ReadonlyArray<RecordEntry<Value>>,
  patch: Pick<FigRecordPatch, 'records' | 'fields' | 'removed' | 'replaceVariables'>,
  decode: (value: Value) => NodeChange
): Array<RecordEntry<Value | NodeChange>> {
  const written = new Map<string, RecordEntry<NodeChange>>()
  for (const record of patch.records) {
    const entry = entryOf(record)
    if (entry.id) written.set(entry.id, entry)
  }
  const removed = writeFieldPatches(archive, patch, written, decode)
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
  patch: Pick<FigRecordPatch, 'records' | 'fields' | 'removed' | 'replaceVariables'>
): NodeChange[] {
  return mergeRecords(archive.map(entryOf), patch, (record) => record).map((entry) => entry.value)
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
  const codec = archiveCodec(schemaDeflated)
  const { schema } = codec
  const scanned = scanMessage(codec, dataRaw)
  const recordsPart = scanned.parts.find((part) => part.kind === 'records')
  // Only the records an edit changed some fields of are decoded; the rest stay bytes.
  const decode = (bytes: Uint8Array): NodeChange => {
    if (recordsPart?.kind !== 'records') throw new Error('The archive has no records')
    return schema.decode(schema.definition(recordsPart.type), new ByteBuffer(bytes))
  }
  const merged = mergeRecords(scanned.records, patch, decode)
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
    const field = schema.definition('Message').fields.find((entry) => entry.name === 'blobs')
    if (!field?.definition) throw new Error('The archive schema has no blobs')
    appendField(field.id, blobs(field.definition.name))
  }
  chunks.push(varUint(0))
  return concat(chunks)
}

/**
 * The archive with the patch applied, in the archive's own schema, written as its reader asks for
 * it. The document is patched and compressed before this returns; the archive's images then pass
 * through as views of `bytes`, so a save holds them once.
 */
export function patchFigArchive(
  bytes: ArrayBuffer,
  patch: FigRecordPatch,
  input: FigPatchedArchiveInput,
  compress?: FigDataCompressor
): ReadableStream<Uint8Array> {
  const parts = readFigArchiveParts(bytes)
  const kiwiData = patchFigMessage(parts.schemaDeflated, parts.dataRaw, patch)
  const archiveImages = new Set(parts.images.map(([hash]) => hash))
  return streamFigArchive({
    canvasFig: buildFigKiwi(
      parts.schemaDeflated,
      kiwiData,
      parts.figKiwiVersion,
      compress,
      input.kind ?? parts.kind
    ),
    thumbnailPNG: input.thumbnailPNG,
    metaJSON: input.metaJSON,
    images: [
      ...parts.images.map(([name, data]) => ({ name: `images/${name}`, data })),
      ...parts.videos.map(([name, data]) => ({ name: `videos/${name}`, data })),
      ...input.images.filter((image) => !archiveImages.has(image.name.replace(/^images\//, '')))
    ]
  })
}
