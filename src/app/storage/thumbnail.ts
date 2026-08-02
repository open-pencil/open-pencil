import { unzipSync } from 'fflate'

import { parseDeckFile, parseFigFile } from '@open-pencil/core/io'
import { headlessRenderThumbnail } from '@open-pencil/core/io/formats/raster'
import { computeAllLayouts } from '@open-pencil/core/layout'

import type { StorageDocumentFormat } from '@/app/integrations/storage'

const THUMBNAIL_WIDTH = 400
const THUMBNAIL_HEIGHT = 225

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

/** Read the archive thumbnail without decoding the document itself. */
export function extractStorageThumbnail(bytes: Uint8Array): Uint8Array | null {
  try {
    const archive = unzipSync(bytes, { filter: (file) => file.name === 'thumbnail.png' })
    const thumbnail = archive['thumbnail.png']
    return thumbnail.byteLength ? thumbnail : null
  } catch {
    return null
  }
}

/** Reject the 1×1 placeholder written when an exporter had no live renderer. */
export function isUsableStorageThumbnail(bytes: Uint8Array | null): bytes is Uint8Array {
  if (!bytes || bytes.byteLength < 24) return false
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[12] === 0x49 &&
    bytes[13] === 0x48 &&
    bytes[14] === 0x44 &&
    bytes[15] === 0x52
  if (!isPng) return bytes.byteLength > 100
  const dimensions = new DataView(bytes.buffer, bytes.byteOffset + 16, 8)
  return dimensions.getUint32(0) > 1 && dimensions.getUint32(4) > 1
}

/** Use an embedded thumbnail when possible, otherwise raster the first page at card size. */
export async function createStorageThumbnail(
  bytes: Uint8Array,
  sourceFormat: StorageDocumentFormat
): Promise<Uint8Array | null> {
  const embedded = extractStorageThumbnail(bytes)
  if (isUsableStorageThumbnail(embedded)) return embedded

  const graph =
    sourceFormat === 'deck'
      ? await parseDeckFile(bytes, { populate: 'first-page' })
      : await parseFigFile(exactArrayBuffer(bytes), { populate: 'first-page' })
  const pageId = graph.getPages()[0]?.id
  if (!pageId) return null
  computeAllLayouts(graph, pageId)
  return headlessRenderThumbnail(graph, pageId, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
}
