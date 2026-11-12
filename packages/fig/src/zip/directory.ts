import { inflateSync } from 'fflate'

/** Byte ranges of a file too large to read whole, such as a remote document. */
export interface FigRangeReader {
  readonly size: number
  read(start: number, endExclusive: number): Promise<Uint8Array>
}

/** An entry of a ZIP archive's central directory. */
export interface ZipEntry {
  name: string
  /** 0 when stored, 8 when deflated. */
  method: number
  compressedSize: number
  size: number
  /** Where the entry's local header begins. */
  localOffset: number
}

/** Where an archive's central directory lies, from its end record. */
export interface ZipDirectoryRange {
  offset: number
  size: number
}

const END_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50
const END_RECORD_BYTES = 22
const CENTRAL_HEADER_BYTES = 46
export const LOCAL_HEADER_BYTES = 30
const MAX_COMMENT_BYTES = 65_535
/** The end record and the longest comment it may carry: where the record is searched for. */
export const ZIP_TAIL_BYTES = END_RECORD_BYTES + MAX_COMMENT_BYTES

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

/** The central directory's range, from the last bytes of an archive; null without an end record. */
export function zipDirectoryRange(tail: Uint8Array): ZipDirectoryRange | null {
  const data = view(tail)
  for (let offset = tail.byteLength - END_RECORD_BYTES; offset >= 0; offset--) {
    if (data.getUint32(offset, true) !== END_SIGNATURE) continue
    return { size: data.getUint32(offset + 12, true), offset: data.getUint32(offset + 16, true) }
  }
  return null
}

/** The entries a central directory lists; null when it is malformed. */
export function zipDirectoryEntries(directory: Uint8Array): ZipEntry[] | null {
  const data = view(directory)
  const decoder = new TextDecoder()
  const entries: ZipEntry[] = []
  for (let offset = 0; offset + CENTRAL_HEADER_BYTES <= directory.byteLength;) {
    if (data.getUint32(offset, true) !== CENTRAL_SIGNATURE) return null
    const nameLength = data.getUint16(offset + 28, true)
    const next =
      offset +
      CENTRAL_HEADER_BYTES +
      nameLength +
      data.getUint16(offset + 30, true) +
      data.getUint16(offset + 32, true)
    if (next > directory.byteLength) return null
    const nameStart = offset + CENTRAL_HEADER_BYTES
    entries.push({
      name: decoder.decode(directory.subarray(nameStart, nameStart + nameLength)),
      method: data.getUint16(offset + 10, true),
      compressedSize: data.getUint32(offset + 20, true),
      size: data.getUint32(offset + 24, true),
      localOffset: data.getUint32(offset + 42, true)
    })
    offset = next
  }
  return entries
}

/** Where an entry's stored bytes begin, from its local header; null when the header is not one. */
export function zipEntryDataOffset(entry: ZipEntry, localHeader: Uint8Array): number | null {
  if (localHeader.byteLength < LOCAL_HEADER_BYTES) return null
  const data = view(localHeader)
  if (data.getUint32(0, true) !== LOCAL_SIGNATURE) return null
  return (
    entry.localOffset + LOCAL_HEADER_BYTES + data.getUint16(26, true) + data.getUint16(28, true)
  )
}

/** The entries of an archive held in memory; null when the bytes are not a ZIP archive. */
export function readZipDirectory(bytes: Uint8Array): ZipEntry[] | null {
  const tailStart = Math.max(0, bytes.byteLength - ZIP_TAIL_BYTES)
  const range = zipDirectoryRange(bytes.subarray(tailStart))
  if (!range || range.offset + range.size > bytes.byteLength) return null
  return zipDirectoryEntries(bytes.subarray(range.offset, range.offset + range.size))
}

/**
 * The bytes an entry stores, as a view of the archive, which holds only for an archive in memory:
 * a stored entry's are its contents, a deflated entry's its compressed stream.
 */
export function zipEntryStoredBytes(bytes: Uint8Array, entry: ZipEntry): Uint8Array {
  const start = zipEntryDataOffset(
    entry,
    bytes.subarray(entry.localOffset, entry.localOffset + LOCAL_HEADER_BYTES)
  )
  if (start === null || start + entry.compressedSize > bytes.byteLength) {
    throw new Error(`ZIP entry ${entry.name} is not where the central directory places it`)
  }
  return bytes.subarray(start, start + entry.compressedSize)
}

/** An entry's contents: a view of the archive when it is stored, inflated when it is deflated. */
export function zipEntryContents(bytes: Uint8Array, entry: ZipEntry): Uint8Array {
  const stored = zipEntryStoredBytes(bytes, entry)
  if (entry.method === 0) return stored
  if (entry.method === 8) return inflateSync(stored, { out: new Uint8Array(entry.size) })
  throw new Error(`ZIP entry ${entry.name} uses compression method ${entry.method}`)
}
