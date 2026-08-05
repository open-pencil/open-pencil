import { unzipSync } from 'fflate'

import { isUniformPixels, parseDeckFile, parseFigFile } from '@open-pencil/core/io'
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

/**
 * True when every sampled pixel is identical — a preview with nothing in it.
 *
 * `isUsableStorageThumbnail` only rejects the 1x1 placeholder, so a full-size
 * blank passed every check: an imported deck carried a 400x260 white
 * `thumbnail.png` that Figma had never rendered, and the workspace preferred it
 * over rastering the slide, which works. The result was a card showing white
 * for a full-bleed image, stored locally and uploaded as if it were real.
 *
 * Decoding needs browser image APIs. Where they are absent the answer is "not
 * blank": refusing a thumbnail we cannot inspect would throw away good previews
 * on the strength of a guess.
 */
export async function isBlankImage(bytes: Uint8Array): Promise<boolean> {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
    return false
  }
  try {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)]))
    const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')
    if (!context) return false
    context.drawImage(bitmap, 0, 0)
    const { data, width } = context.getImageData(0, 0, bitmap.width, bitmap.height)
    return isUniformPixels(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width)
  } catch {
    return false
  }
}

/** Use an embedded thumbnail when possible, otherwise raster the first page at card size. */
export async function createStorageThumbnail(
  bytes: Uint8Array,
  sourceFormat: StorageDocumentFormat
): Promise<Uint8Array | null> {
  const embedded = extractStorageThumbnail(bytes)
  // A blank embedded preview is worse than none: it is indistinguishable from a
  // real one downstream, and rastering the page is known to produce the slide.
  if (isUsableStorageThumbnail(embedded) && !(await isBlankImage(embedded))) return embedded

  const graph =
    sourceFormat === 'deck'
      ? await parseDeckFile(bytes, { populate: 'first-page' })
      : await parseFigFile(exactArrayBuffer(bytes), { populate: 'first-page' })
  const pageId = graph.getPages()[0]?.id
  if (!pageId) return null
  computeAllLayouts(graph, pageId)
  return headlessRenderThumbnail(graph, pageId, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
}
