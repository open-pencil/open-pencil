import type { FileHandle } from 'node:fs/promises'

const COLLECTION_TAG = 'ttcf'
const OFFSET_TABLE_SIZE = 12
const TABLE_RECORD_SIZE = 16
/** A collection's face count is a 32-bit field; real collections hold a handful of faces. */
const MAX_COLLECTION_FACES = 0xffff
/** The versions a single font's table directory starts with: TrueType, CFF, and Apple's `true`. */
const SFNT_VERSIONS = new Set([0x00010000, 0x4f54544f, 0x74727565])
/** The tables a renderer draws outlines from; Apple's `hvgl` (PingFang on macOS 15) is not one. */
const OUTLINE_TABLES = new Set(['glyf', 'CFF ', 'CFF2'])

/** A table a face lists: its tag and where its bytes lie in the file. */
export interface TableRecord {
  tag: string
  offset: number
  length: number
}

/** One face of a font file: its position in a collection, its table directory's offset, and its tables. */
export interface SfntFace {
  index: number
  offset: number
  tables: TableRecord[]
}

function tagAt(view: DataView, offset: number): string {
  let tag = ''
  for (let i = 0; i < 4; i++) tag += String.fromCharCode(view.getUint8(offset + i))
  return tag
}

async function readView(file: FileHandle, position: number, length: number) {
  const bytes = new Uint8Array(length)
  const { bytesRead } = await file.read(bytes, 0, length, position)
  return bytesRead === length ? new DataView(bytes.buffer) : null
}

/**
 * The tables a face's directory lists, or `null` when it is not a font's directory or names a
 * table beyond the end of the file, so no read later sizes a buffer by a length the file lacks.
 */
async function readTableDirectory(
  file: FileHandle,
  offset: number,
  fileSize: number
): Promise<TableRecord[] | null> {
  const header = await readView(file, offset, OFFSET_TABLE_SIZE)
  if (!header || !SFNT_VERSIONS.has(header.getUint32(0))) return null
  const count = header.getUint16(4)
  const records = await readView(file, offset + OFFSET_TABLE_SIZE, count * TABLE_RECORD_SIZE)
  if (!records) return null
  const tables = Array.from({ length: count }, (_, i) => {
    const record = i * TABLE_RECORD_SIZE
    return {
      tag: tagAt(records, record),
      offset: records.getUint32(record + 8),
      length: records.getUint32(record + 12)
    }
  })
  return tables.every((table) => table.offset + table.length <= fileSize) ? tables : null
}

/**
 * The faces a font file holds, one or each of a collection's, from their table directories
 * alone: a system's fonts run to gigabytes, so the tables themselves are read only when needed.
 */
export async function readSfntFaces(file: FileHandle): Promise<SfntFace[]> {
  const header = await readView(file, 0, OFFSET_TABLE_SIZE)
  if (!header) return []
  const { size } = await file.stat()
  let offsets = [0]
  if (tagAt(header, 0) === COLLECTION_TAG) {
    const count = header.getUint32(8)
    if (count > MAX_COLLECTION_FACES) return []
    const list = await readView(file, OFFSET_TABLE_SIZE, count * 4)
    if (!list) return []
    const headerEnd = OFFSET_TABLE_SIZE + count * 4
    // A face's directory comes after the collection's header, never inside it.
    offsets = Array.from({ length: count }, (_, i) => list.getUint32(i * 4))
    if (offsets.some((offset) => offset < headerEnd)) return []
  }
  const faces: SfntFace[] = []
  for (const [index, offset] of offsets.entries()) {
    const tables = await readTableDirectory(file, offset, size)
    if (tables) faces.push({ index, offset, tables })
  }
  return faces
}

/** Whether the face stores outlines in a table the renderer draws. */
export function hasDrawableOutlines(face: SfntFace): boolean {
  return face.tables.some((table) => OUTLINE_TABLES.has(table.tag))
}

/**
 * A font of only the face's tables that `tags` names, read from the file, for the readers that
 * take a whole font, such as `fontFaceName` and `fontAxes`.
 */
export async function readTableSubset(
  file: FileHandle,
  face: SfntFace,
  tags: readonly string[]
): Promise<ArrayBuffer | null> {
  const tables = face.tables.filter((table) => tags.includes(table.tag))
  const directorySize = OFFSET_TABLE_SIZE + tables.length * TABLE_RECORD_SIZE
  const placed = tables.map((table, i) => ({
    ...table,
    // Each table starts on a four-byte boundary, as the format asks.
    at: directorySize + tables.slice(0, i).reduce((sum, t) => sum + Math.ceil(t.length / 4) * 4, 0)
  }))
  const size = placed.reduce((end, table) => Math.max(end, table.at + table.length), directorySize)
  const font = new Uint8Array(size)
  const view = new DataView(font.buffer)
  view.setUint32(0, 0x00010000)
  view.setUint16(4, tables.length)
  for (const [i, table] of placed.entries()) {
    const record = OFFSET_TABLE_SIZE + i * TABLE_RECORD_SIZE
    for (let c = 0; c < 4; c++) view.setUint8(record + c, table.tag.charCodeAt(c))
    view.setUint32(record + 8, table.at)
    view.setUint32(record + 12, table.length)
    const { bytesRead } = await file.read(font, table.at, table.length, table.offset)
    if (bytesRead !== table.length) return null
  }
  return font.buffer
}

/**
 * Font data whose first table directory is the face's, which renderers that read only a
 * collection's first face (CanvasKit) accept. A collection's table offsets count from the start
 * of the file, so the tables stay where they are.
 */
export function standaloneFace(
  data: Uint8Array<ArrayBuffer>,
  face: SfntFace
): Uint8Array<ArrayBuffer> | null {
  if (face.offset === 0) return data
  const size = OFFSET_TABLE_SIZE + face.tables.length * TABLE_RECORD_SIZE
  if (face.offset + size > data.byteLength) return null
  // The directory written at the start must not land on a table the face reads.
  if (face.tables.some((table) => table.offset < size)) return null
  const standalone = data.slice()
  standalone.copyWithin(0, face.offset, face.offset + size)
  return standalone
}
