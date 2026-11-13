import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import {
  buildFigKiwi,
  type FigDataCompressor,
  type FigFileKind
} from '@open-pencil/kiwi/fig/container'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import {
  ByteBuffer,
  type RuntimeCodec,
  type RuntimeMessage
} from '@open-pencil/kiwi/schema-runtime'

import { readFigArchiveParts, streamFigArchive, type FigImageEntry } from '../archive'
import { guidKey } from './entry'
import { mergeRecords, type FigRecordPatch } from './merge'
import { archiveCodec, scanMessage } from './scan'

export {
  entryPathKey,
  type FigEntryListPatch,
  type FigEntryPatch,
  type FigRecordFieldPatch
} from './fields'
export { patchFigRecords, type FigRecordPatch } from './merge'
export {
  figArchiveComponentUsePages,
  figArchiveRecordPages,
  figComponentUsePages,
  figRecordPages
} from './pages'

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
    documentId: guidKey(archive.records.find((record) => record.type === 'DOCUMENT')?.guid) ?? null
  }
}

function varUint(value: number): Uint8Array {
  const bb = new ByteBuffer()
  bb.writeVarUint(value)
  return bb.toUint8Array().slice()
}

function encoded(codec: RuntimeCodec, type: string, value: unknown): Uint8Array {
  const bb = new ByteBuffer()
  codec.schema.encode(codec.schema.definition(type), value as RuntimeMessage, bb)
  return bb.toUint8Array().slice()
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
