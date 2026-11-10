import { inflateSync } from 'fflate'

import { imageHeader } from '@open-pencil/scene-graph/images'

import {
  LOCAL_HEADER_BYTES,
  ZIP_TAIL_BYTES,
  zipDirectoryEntries,
  zipDirectoryRange,
  zipEntryDataOffset,
  type FigRangeReader,
  type ZipEntry
} from './zip/directory'

export type FigThumbnailLimits = {
  maxTailBytes?: number
  maxCompressedBytes?: number
  maxOutputBytes?: number
}

const DEFAULT_MAX_TAIL = 4 * 1024 * 1024
const DEFAULT_MAX_COMPRESSED = 8 * 1024 * 1024
const DEFAULT_MAX_OUTPUT = 16 * 1024 * 1024
const THUMBNAIL_NAME = 'thumbnail.png'

function boundedLimit(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value && value > 0 ? value : fallback
}

/** Whether `bytes` hold a PNG, as a `.fig` thumbnail does. */
export function isPNG(bytes: Uint8Array): boolean {
  return imageHeader(bytes)?.type === 'image/png'
}

function hasUsablePNGDimensions(bytes: Uint8Array): boolean {
  const header = imageHeader(bytes)
  return header?.type === 'image/png' && header.width > 1 && header.height > 1
}

async function readEntryPayload(
  reader: FigRangeReader,
  entry: ZipEntry,
  maxOutput: number
): Promise<Uint8Array | null> {
  const header = await reader.read(
    entry.localOffset,
    Math.min(reader.size, entry.localOffset + LOCAL_HEADER_BYTES)
  )
  const dataStart = zipEntryDataOffset(entry, header)
  if (dataStart === null || dataStart + entry.compressedSize > reader.size) return null
  const compressed = await reader.read(dataStart, dataStart + entry.compressedSize)
  if (entry.method === 0) {
    return compressed.byteLength === entry.size && hasUsablePNGDimensions(compressed)
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
  return output?.byteLength === entry.size && hasUsablePNGDimensions(output) ? output : null
}

/**
 * Extract Figma's canonical `thumbnail.png` from a remote `.fig` ZIP through
 * bounded range reads. The complete document is never requested.
 */
export async function extractFigThumbnailFromReader(
  reader: FigRangeReader,
  limits: FigThumbnailLimits = {}
): Promise<Uint8Array | null> {
  if (!Number.isSafeInteger(reader.size) || reader.size === 0) return null
  const maxCentral = boundedLimit(limits.maxTailBytes, DEFAULT_MAX_TAIL)
  const maxCompressed = boundedLimit(limits.maxCompressedBytes, DEFAULT_MAX_COMPRESSED)
  const maxOutput = boundedLimit(limits.maxOutputBytes, DEFAULT_MAX_OUTPUT)
  const tailStart = Math.max(0, reader.size - ZIP_TAIL_BYTES)
  const tail = await reader.read(tailStart, reader.size)
  const range = zipDirectoryRange(tail)
  if (!range || range.size > maxCentral || range.offset + range.size > reader.size) return null
  const central =
    range.offset >= tailStart
      ? tail.subarray(range.offset - tailStart, range.offset - tailStart + range.size)
      : await reader.read(range.offset, range.offset + range.size)
  const entry = zipDirectoryEntries(central)?.find((item) => item.name === THUMBNAIL_NAME)
  if (!entry || entry.compressedSize > maxCompressed || entry.size > maxOutput) return null
  return readEntryPayload(reader, entry, maxOutput)
}
