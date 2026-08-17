import { inflateSync } from 'fflate'

export interface FigRangeReader {
  readonly size: number
  read(start: number, endExclusive: number): Promise<Uint8Array>
}

export type FigThumbnailLimits = {
  maxTailBytes?: number
  maxCompressedBytes?: number
  maxOutputBytes?: number
}

type ThumbnailEntry = {
  method: number
  compressedSize: number
  outputSize: number
  localOffset: number
}

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50
const EOCD_MIN_SIZE = 22
const MAX_ZIP_COMMENT = 65_535
const DEFAULT_MAX_TAIL = 4 * 1024 * 1024
const DEFAULT_MAX_COMPRESSED = 8 * 1024 * 1024
const DEFAULT_MAX_OUTPUT = 16 * 1024 * 1024
const THUMBNAIL_NAME = 'thumbnail.png'
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function findEOCD(bytes: Uint8Array): number {
  const data = view(bytes)
  for (let offset = bytes.byteLength - EOCD_MIN_SIZE; offset >= 0; offset--) {
    if (data.getUint32(offset, true) === EOCD_SIGNATURE) return offset
  }
  return -1
}

function boundedLimit(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value && value > 0 ? value : fallback
}

function hasPNGSignature(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
}

function findThumbnailEntry(
  central: Uint8Array,
  maxCompressed: number,
  maxOutput: number
): ThumbnailEntry | null {
  const data = view(central)
  const decoder = new TextDecoder()
  for (let offset = 0; offset + 46 <= central.byteLength; ) {
    if (data.getUint32(offset, true) !== CENTRAL_SIGNATURE) return null
    const method = data.getUint16(offset + 10, true)
    const compressedSize = data.getUint32(offset + 20, true)
    const outputSize = data.getUint32(offset + 24, true)
    const nameLength = data.getUint16(offset + 28, true)
    const next =
      offset +
      46 +
      nameLength +
      data.getUint16(offset + 30, true) +
      data.getUint16(offset + 32, true)
    if (next > central.byteLength) return null
    const name = decoder.decode(central.subarray(offset + 46, offset + 46 + nameLength))
    if (name === THUMBNAIL_NAME) {
      if (compressedSize > maxCompressed || outputSize > maxOutput) return null
      return {
        method,
        compressedSize,
        outputSize,
        localOffset: data.getUint32(offset + 42, true)
      }
    }
    offset = next
  }
  return null
}

async function readEntryPayload(
  reader: FigRangeReader,
  entry: ThumbnailEntry,
  maxOutput: number
): Promise<Uint8Array | null> {
  const header = await reader.read(entry.localOffset, Math.min(reader.size, entry.localOffset + 30))
  if (header.byteLength < 30 || view(header).getUint32(0, true) !== LOCAL_SIGNATURE) return null
  const headerView = view(header)
  const dataStart =
    entry.localOffset + 30 + headerView.getUint16(26, true) + headerView.getUint16(28, true)
  if (dataStart + entry.compressedSize > reader.size) return null
  const compressed = await reader.read(dataStart, dataStart + entry.compressedSize)
  if (entry.method === 0) {
    return compressed.byteLength === entry.outputSize && hasPNGSignature(compressed)
      ? compressed
      : null
  }
  if (entry.method !== 8) return null
  const output = (() => {
    try {
      return inflateSync(compressed, { out: new Uint8Array(maxOutput + 1) })
    } catch {
      return null
    }
  })()
  return output?.byteLength === entry.outputSize && hasPNGSignature(output) ? output : null
}

/**
 * Extract Figma's canonical `thumbnail.png` from a remote `.fig` ZIP through
 * bounded range reads. The complete document is never requested.
 */
export async function extractFigThumbnailFromReader(
  reader: FigRangeReader,
  limits: FigThumbnailLimits = {}
): Promise<Uint8Array | null> {
  if (!Number.isSafeInteger(reader.size) || reader.size < EOCD_MIN_SIZE) return null
  const maxCentral = boundedLimit(limits.maxTailBytes, DEFAULT_MAX_TAIL)
  const maxCompressed = boundedLimit(limits.maxCompressedBytes, DEFAULT_MAX_COMPRESSED)
  const maxOutput = boundedLimit(limits.maxOutputBytes, DEFAULT_MAX_OUTPUT)
  const tailSize = Math.min(reader.size, EOCD_MIN_SIZE + MAX_ZIP_COMMENT)
  const tailStart = reader.size - tailSize
  const tail = await reader.read(tailStart, reader.size)
  const eocd = findEOCD(tail)
  if (eocd < 0) return null

  const tailView = view(tail)
  const centralSize = tailView.getUint32(eocd + 12, true)
  const centralOffset = tailView.getUint32(eocd + 16, true)
  if (centralSize > maxCentral || centralOffset + centralSize > reader.size) return null
  const central =
    centralOffset >= tailStart && centralOffset + centralSize <= reader.size
      ? tail.subarray(centralOffset - tailStart, centralOffset - tailStart + centralSize)
      : await reader.read(centralOffset, centralOffset + centralSize)
  const entry = findThumbnailEntry(central, maxCompressed, maxOutput)
  return entry ? readEntryPayload(reader, entry, maxOutput) : null
}
