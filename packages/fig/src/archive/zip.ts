import { deflateSync, inflateSync } from 'fflate'
import * as v from 'valibot'

import { figFileKind } from '@open-pencil/kiwi/fig/container'

import type { FigImageEntry } from '../archive'

/**
 * A ZIP entry written by the streaming writer. `data` holds exactly the bytes the archive stores,
 * already deflated for method 8; `source` names a range of an existing archive instead.
 */
export interface ZipEntrySource {
  name: string
  method: 0 | 8
  crc: number
  compressedSize: number
  uncompressedSize: number
  data?: Uint8Array
  source?: Uint8Array
  offset?: number
}

export interface ZipEntryInfo {
  name: string
  method: number
  crc: number
  compressedSize: number
  uncompressedSize: number
  /** Where the entry's stored bytes begin in the archive. */
  dataOffset: number
}

export type ZipSink = (chunk: Uint8Array) => void | Promise<void>

export interface ZipStreamOptions {
  /** Called after each entry, and once more after the central directory, with the byte total. */
  onProgress?: (written: number, total: number) => void
}

const LOCAL_HEADER_BYTES = 30
const CENTRAL_HEADER_BYTES = 46
const END_RECORD_BYTES = 22
const UTF8_FLAG = 0x0800
/** A fixed DOS date (1980-01-01) keeps a streamed archive byte-stable between saves. */
const DOS_DATE = (1 << 5) | 1
const CHUNK_BYTES = 1024 * 1024
/** The largest offsets and entry count a ZIP without ZIP64 records can describe. */
const MAX_CLASSIC_ZIP_BYTES = 0xffffffff
const MAX_CLASSIC_ZIP_ENTRIES = 0xffff

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index++) {
    let value = index
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[index] = value >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let index = 0; index < bytes.byteLength; index++) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** A stored entry from bytes that are already in memory. */
export function storedZipEntry(name: string, bytes: Uint8Array): ZipEntrySource {
  return {
    name,
    method: 0,
    crc: crc32(bytes),
    compressedSize: bytes.byteLength,
    uncompressedSize: bytes.byteLength,
    data: bytes
  }
}

/** A deflated entry, for the archive's tiny `meta.json`. */
export function deflatedZipEntry(name: string, bytes: Uint8Array): ZipEntrySource {
  const compressed = deflateSync(bytes)
  return {
    name,
    method: 8,
    crc: crc32(bytes),
    compressedSize: compressed.byteLength,
    uncompressedSize: bytes.byteLength,
    data: compressed
  }
}

function entryBytes(entry: ZipEntrySource): Uint8Array {
  const offset = entry.offset ?? 0
  const bytes = entry.data ?? entry.source?.subarray(offset, offset + entry.compressedSize)
  if (!bytes || bytes.byteLength !== entry.compressedSize) {
    throw new Error(
      `ZIP entry ${entry.name} has ${bytes?.byteLength ?? 0} bytes, expected ${entry.compressedSize}`
    )
  }
  return bytes
}

function writeHeader(view: DataView, entry: ZipEntrySource): void {
  view.setUint32(0, 0x04034b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, UTF8_FLAG, true)
  view.setUint16(8, entry.method, true)
  view.setUint16(10, 0, true)
  view.setUint16(12, DOS_DATE, true)
  view.setUint32(14, entry.crc, true)
  view.setUint32(18, entry.compressedSize, true)
  view.setUint32(22, entry.uncompressedSize, true)
  view.setUint16(26, nameBytes(entry.name).byteLength, true)
  view.setUint16(28, 0, true)
}

function nameBytes(name: string): Uint8Array {
  return new TextEncoder().encode(name)
}

function centralHeader(entry: ZipEntrySource, localOffset: number): Uint8Array {
  const name = nameBytes(entry.name)
  const header = new Uint8Array(CENTRAL_HEADER_BYTES + name.byteLength)
  const view = new DataView(header.buffer)
  view.setUint32(0, 0x02014b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, 20, true)
  view.setUint16(8, UTF8_FLAG, true)
  view.setUint16(10, entry.method, true)
  view.setUint16(12, 0, true)
  view.setUint16(14, DOS_DATE, true)
  view.setUint32(16, entry.crc, true)
  view.setUint32(20, entry.compressedSize, true)
  view.setUint32(24, entry.uncompressedSize, true)
  view.setUint16(28, name.byteLength, true)
  view.setUint16(30, 0, true)
  view.setUint16(32, 0, true)
  view.setUint16(34, 0, true)
  view.setUint16(36, 0, true)
  view.setUint32(38, 0, true)
  view.setUint32(42, localOffset, true)
  header.set(name, CENTRAL_HEADER_BYTES)
  return header
}

function headerFor(entry: ZipEntrySource): Uint8Array {
  const name = nameBytes(entry.name)
  const header = new Uint8Array(LOCAL_HEADER_BYTES + name.byteLength)
  writeHeader(new DataView(header.buffer), entry)
  header.set(name, LOCAL_HEADER_BYTES)
  return header
}

function totalBytes(entries: readonly ZipEntrySource[]): number {
  let total = END_RECORD_BYTES
  for (const entry of entries) {
    const nameLength = nameBytes(entry.name).byteLength
    total += LOCAL_HEADER_BYTES + nameLength + entry.compressedSize
    total += CENTRAL_HEADER_BYTES + nameLength
  }
  return total
}

/**
 * Writes a ZIP archive one entry at a time into `sink`, never holding the archive itself. Entry
 * data that already lives in memory or in an earlier archive is handed to the sink as views, so a
 * save costs the file's own bytes, not a second copy of them.
 */
export async function writeZipStream(
  entries: readonly ZipEntrySource[],
  sink: ZipSink,
  options: ZipStreamOptions = {}
): Promise<void> {
  if (entries.length > MAX_CLASSIC_ZIP_ENTRIES) {
    throw new Error('A ZIP archive can hold at most 65,535 entries')
  }
  const total = totalBytes(entries)
  if (total > MAX_CLASSIC_ZIP_BYTES) {
    throw new Error('A ZIP archive can hold at most 4 GiB; this archive is larger')
  }
  let written = 0
  const central: Array<{ entry: ZipEntrySource; offset: number }> = []

  for (const entry of entries) {
    const offset = written
    const header = headerFor(entry)
    await sink(header)
    written += header.byteLength
    options.onProgress?.(written, total)
    const bytes = entryBytes(entry)
    for (let start = 0; start < bytes.byteLength; start += CHUNK_BYTES) {
      const chunk = bytes.subarray(start, Math.min(start + CHUNK_BYTES, bytes.byteLength))
      await sink(chunk)
      written += chunk.byteLength
      options.onProgress?.(written, total)
    }
    central.push({ entry, offset })
  }

  const directoryOffset = written
  for (const { entry, offset } of central) {
    const header = centralHeader(entry, offset)
    await sink(header)
    written += header.byteLength
  }

  const end = new Uint8Array(END_RECORD_BYTES)
  const view = new DataView(end.buffer)
  view.setUint32(0, 0x06054b50, true)
  view.setUint16(8, central.length, true)
  view.setUint16(10, central.length, true)
  view.setUint32(12, written - directoryOffset, true)
  view.setUint32(16, directoryOffset, true)
  await sink(end)
  written += end.byteLength
  options.onProgress?.(written, total)
}

interface EndRecord {
  count: number
  directoryOffset: number
}

function endRecord(bytes: Uint8Array): EndRecord {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const minimum = Math.max(0, bytes.byteLength - 65_557)
  for (let offset = bytes.byteLength - END_RECORD_BYTES; offset >= minimum; offset--) {
    if (view.getUint32(offset, true) !== 0x06054b50) continue
    const count = view.getUint16(offset + 10, true)
    const directoryOffset = view.getUint32(offset + 16, true)
    if (count === 0xffff || directoryOffset === 0xffffffff) {
      throw new Error('ZIP64 archives cannot be streamed')
    }
    return { count, directoryOffset }
  }
  throw new Error('Not a ZIP archive: no end of central directory record')
}

/** The central directory's entries, with the offset of each entry's stored bytes. */
export function readZipEntries(bytes: Uint8Array): ZipEntryInfo[] {
  const end = endRecord(bytes)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entries: ZipEntryInfo[] = []
  let offset = end.directoryOffset
  for (let index = 0; index < end.count; index++) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('Invalid ZIP central directory')
    }
    const method = view.getUint16(offset + 10, true)
    const crc = view.getUint32(offset + 16, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const uncompressedSize = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new Error('ZIP64 entries cannot be streamed')
    }
    const name = new TextDecoder().decode(
      bytes.subarray(offset + CENTRAL_HEADER_BYTES, offset + CENTRAL_HEADER_BYTES + nameLength)
    )
    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error(`Invalid ZIP local header for ${name}`)
    }
    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    const dataOffset = localOffset + LOCAL_HEADER_BYTES + localNameLength + localExtraLength
    if (dataOffset + compressedSize > bytes.byteLength) {
      throw new Error(`ZIP entry ${name} extends past the archive`)
    }
    entries.push({ name, method, crc, compressedSize, uncompressedSize, dataOffset })
    offset += CENTRAL_HEADER_BYTES + nameLength + extraLength + commentLength
  }
  return entries
}

/** A source that copies an entry's stored bytes unchanged. */
export function copyZipEntry(entry: ZipEntryInfo, source: Uint8Array): ZipEntrySource {
  return {
    name: entry.name,
    method: entry.method as 0 | 8,
    crc: entry.crc,
    compressedSize: entry.compressedSize,
    uncompressedSize: entry.uncompressedSize,
    source,
    offset: entry.dataOffset
  }
}

/** The entries of `bytes` as sources that copy their stored bytes unchanged. */
export function copyZipEntries(bytes: Uint8Array): ZipEntrySource[] {
  return readZipEntries(bytes).map((entry) => copyZipEntry(entry, bytes))
}

/**
 * The archive's `meta.json` with its `file_name` replaced, every other entry copied, or `false`
 * when its `meta.json` records no name to replace (the caller then writes the archive whole).
 */
export async function renameFigArchiveStream(
  bytes: Uint8Array,
  fileName: string,
  sink: ZipSink,
  options?: ZipStreamOptions
): Promise<boolean> {
  if (figFileKind(bytes)) return false
  const entries = copyZipEntries(bytes)
  const meta = entries.find((entry) => entry.name === 'meta.json')
  if (!meta) return false
  const stored = readZipEntries(bytes).find((entry) => entry.name === 'meta.json')
  if (!stored) return false
  const raw =
    stored.method === 0
      ? bytes.subarray(stored.dataOffset, stored.dataOffset + stored.compressedSize)
      : inflateEntry(bytes, stored)
  const parsed = v.safeParse(
    v.pipe(v.string(), v.parseJson(), v.record(v.string(), v.unknown())),
    new TextDecoder().decode(raw)
  )
  if (!parsed.success || typeof parsed.output.file_name !== 'string') return false
  if (parsed.output.file_name === fileName) {
    await writeZipStream(entries, sink, options)
    return true
  }
  const replaced = entries.map((entry) =>
    entry.name === 'meta.json'
      ? deflatedZipEntry(
          'meta.json',
          new TextEncoder().encode(JSON.stringify({ ...parsed.output, file_name: fileName }))
        )
      : entry
  )
  await writeZipStream(replaced, sink, options)
  return true
}

function inflateEntry(bytes: Uint8Array, entry: ZipEntryInfo): Uint8Array {
  const compressed = bytes.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize)
  // Only `meta.json` is normally deflated; images are stored and copied without inflating.
  return inflateSync(compressed)
}

/** Streaming counterpart of `writeFigArchive`, given its already compressed canvas container. */
export interface WriteFigArchiveStreamInput {
  canvasFig: Uint8Array
  thumbnailPNG: Uint8Array
  metaJSON: string
  images?: FigImageEntry[]
}

export async function writeFigArchiveStream(
  input: WriteFigArchiveStreamInput,
  sink: ZipSink,
  options?: ZipStreamOptions
): Promise<void> {
  const entries: ZipEntrySource[] = [
    storedZipEntry('canvas.fig', input.canvasFig),
    storedZipEntry('thumbnail.png', input.thumbnailPNG),
    deflatedZipEntry('meta.json', new TextEncoder().encode(input.metaJSON))
  ]
  for (const image of input.images ?? []) entries.push(storedZipEntry(image.name, image.data))
  await writeZipStream(entries, sink, options)
}
