import type { CanvasKit } from 'canvaskit-wasm'
import { unzipSync } from 'fflate'

import type { SkiaRenderer } from '@open-pencil/core/canvas'
import { renderThumbnail } from '@open-pencil/core/io'
import type { SceneGraph } from '@open-pencil/scene-graph'

import type { CloudStorageAdapter } from '@/app/cloud/types'

/** Match fig export thumbnail aspect (16:9-ish card cover). */
export const CLOUD_THUMB_WIDTH = 400
export const CLOUD_THUMB_HEIGHT = 225
const THUMB_JPEG_QUALITY = 0.85

/** Skip 1×1 / stub thumbnails that some exporters embed. */
const MIN_THUMB_BYTES = 256

/**
 * Blank board placeholders we generate are small (~2.5–3.2KB). Real content
 * thumbs we measured on B2 were ≥6KB. Used only as a heal heuristic for
 * already-uploaded blanks from older builds (fingerprint set is session-local).
 */
const LIKELY_BLANK_BOARD_MAX_BYTES = 3200

/** Fingerprints of blank-board JPEGs generated this session (exact match). */
const provisionalThumbFingerprints = new Set<string>()

export type ThumbnailRenderSource = {
  graph: SceneGraph
  pageId?: string | null
  /** Prefer the live editor renderer (has fonts + correct page color). */
  renderer?: SkiaRenderer | null
  ck?: CanvasKit | null
}

function fingerprintThumbBytes(bytes: Uint8Array): string {
  // FNV-1a 32-bit — fine for small JPEGs, no crypto needed.
  let hash = 0x811c9dc5
  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193)
  }
  return `${bytes.length}:${hash >>> 0}`
}

/**
 * True for missing/stub embeds and blank-board placeholders.
 * These must not be treated as final cloud card previews.
 */
export function isProvisionalCloudThumbnail(bytes: Uint8Array | null | undefined): boolean {
  if (!bytes || bytes.byteLength < MIN_THUMB_BYTES) return true
  if (provisionalThumbFingerprints.has(fingerprintThumbBytes(bytes))) return true
  // Heal blanks already on disk/B2 from earlier builds (same size band as our template).
  return bytes.byteLength <= LIKELY_BLANK_BOARD_MAX_BYTES
}

/**
 * Pull `thumbnail.png` from a Figma .fig ZIP (same asset Figma’s file browser uses).
 * Returns null when missing or clearly a stub.
 */
export function extractFigThumbnailPng(figBytes: Uint8Array): Uint8Array | null {
  if (figBytes.byteLength < 4) return null
  // ZIP signature
  if (figBytes[0] !== 0x50 || figBytes[1] !== 0x4b) return null

  let zip: Record<string, Uint8Array>
  try {
    zip = unzipSync(figBytes, {
      filter: (file) => file.name === 'thumbnail.png'
    })
  } catch {
    return null
  }

  if (!('thumbnail.png' in zip)) return null
  const png = zip['thumbnail.png']
  if (png.byteLength < MIN_THUMB_BYTES) return null
  // PNG magic
  if (png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) return null
  return png
}

/**
 * Render a page overview PNG with CanvasKit (content fit — same idea as Figma’s file preview).
 * Returns null for empty pages or when no renderer/ck is available.
 */
export function renderGraphThumbnailPng(source: ThumbnailRenderSource): Uint8Array | null {
  const renderer = source.renderer ?? null
  const ck = source.ck ?? renderer?.ck ?? null
  if (!ck || !renderer) return null

  const pageId = source.pageId ?? source.graph.getPages()[0]?.id
  if (!pageId) return null

  try {
    return renderThumbnail(
      ck,
      renderer,
      source.graph,
      pageId,
      CLOUD_THUMB_WIDTH,
      CLOUD_THUMB_HEIGHT
    )
  } catch (error) {
    console.warn('[Cloud] Graph thumbnail render failed:', error)
    return null
  }
}

/**
 * Empty-canvas placeholder (dark board) so new files still get a card preview.
 * Uses 2D canvas — no CanvasKit required.
 */
export async function renderBlankCanvasThumbnailJpeg(): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = CLOUD_THUMB_WIDTH
  canvas.height = CLOUD_THUMB_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Page chrome
  ctx.fillStyle = '#2c2c2c'
  ctx.fillRect(0, 0, CLOUD_THUMB_WIDTH, CLOUD_THUMB_HEIGHT)

  // Soft artboard
  const padX = 48
  const padY = 36
  const boardW = CLOUD_THUMB_WIDTH - padX * 2
  const boardH = CLOUD_THUMB_HEIGHT - padY * 2
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 4
  ctx.fillRect(padX, padY, boardW, boardH)
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = 'rgba(0,0,0,0.08)'
  ctx.lineWidth = 1
  ctx.strokeRect(padX + 0.5, padY + 0.5, boardW - 1, boardH - 1)

  const jpegBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', THUMB_JPEG_QUALITY)
  })
  if (!jpegBlob) return null
  const bytes = new Uint8Array(await jpegBlob.arrayBuffer())
  provisionalThumbFingerprints.add(fingerprintThumbBytes(bytes))
  return bytes
}

/**
 * Resize + re-encode to JPEG for compact cloud card previews.
 * Falls back to the original PNG bytes when canvas APIs are unavailable.
 */
export async function encodeThumbnailJpeg(imageBytes: Uint8Array): Promise<Uint8Array> {
  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') {
    return imageBytes
  }

  const copy = new Uint8Array(imageBytes.byteLength)
  copy.set(imageBytes)
  const blob = new Blob([copy])
  const bitmap = await createImageBitmap(blob)
  try {
    const scale = Math.min(
      1,
      CLOUD_THUMB_WIDTH / Math.max(1, bitmap.width),
      CLOUD_THUMB_HEIGHT / Math.max(1, bitmap.height)
    )
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return imageBytes

    // Neutral dark matte — matches editor chrome if the artboard doesn’t fill the frame.
    ctx.fillStyle = '#1e1e1e'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)

    const jpegBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', THUMB_JPEG_QUALITY)
    })
    if (!jpegBlob) return imageBytes
    return new Uint8Array(await jpegBlob.arrayBuffer())
  } finally {
    bitmap.close()
  }
}

async function putJpegThumbnail(
  adapter: CloudStorageAdapter,
  canvasId: string,
  jpegBytes: Uint8Array
): Promise<boolean> {
  if (!adapter.putThumbnail) return false
  // Never promote blank/stub placeholders to the shared bucket — they stick
  // forever for other browsers and look like "white" cards on the home grid.
  if (isProvisionalCloudThumbnail(jpegBytes)) return false
  try {
    await adapter.putThumbnail(canvasId, jpegBytes)
    return true
  } catch (error) {
    console.warn('[Cloud] Failed to upload canvas thumbnail:', error)
    return false
  }
}

/** Best-effort: extract fig thumbnail → JPEG → putThumbnail. Never throws. */
export async function uploadFigThumbnail(
  adapter: CloudStorageAdapter,
  canvasId: string,
  figBytes: Uint8Array
): Promise<boolean> {
  if (!adapter.putThumbnail) return false
  const png = extractFigThumbnailPng(figBytes)
  if (!png) return false
  try {
    const jpeg = await encodeThumbnailJpeg(png)
    return await putJpegThumbnail(adapter, canvasId, jpeg)
  } catch (error) {
    console.warn('[Cloud] Failed to process fig thumbnail:', error)
    return false
  }
}

/**
 * Generate (or regenerate) the cloud card preview and PUT it to storage.
 * Always overwrites the previous object key when successful.
 *
 * Priority:
 * 1) Live CanvasKit render of the current page (what the canvas looks like now)
 * 2) Embedded `thumbnail.png` from a .fig ZIP (imported Figma files)
 *
 * Blank-board placeholders stay local-only (home cards hydrate them in-session).
 * Never upload stubs — they stick on shared storage and show as white cards.
 *
 * `allowBlankPlaceholder` is accepted for call-site compatibility but no longer
 * uploads anything; use local `renderBlankCanvasThumbnailJpeg` for UI-only cards.
 */
export async function uploadCanvasThumbnail(
  adapter: CloudStorageAdapter,
  canvasId: string,
  options: {
    figBytes?: Uint8Array | null
    graph?: SceneGraph | null
    pageId?: string | null
    renderer?: SkiaRenderer | null
    ck?: CanvasKit | null
    /**
     * @deprecated Blank placeholders are never uploaded. Kept so callers still
     * type-check; pass ignored.
     */
    allowBlankPlaceholder?: boolean
  } = {}
): Promise<boolean> {
  if (!adapter.putThumbnail) return false

  // Freshest paint state before snapshotting the page.
  options.renderer?.invalidateAllPictures()

  // 1) Render what the canvas actually looks like (our own content).
  if (options.graph) {
    const rendered = renderGraphThumbnailPng({
      graph: options.graph,
      pageId: options.pageId,
      renderer: options.renderer,
      ck: options.ck
    })
    if (rendered && rendered.byteLength >= MIN_THUMB_BYTES) {
      try {
        const jpeg = await encodeThumbnailJpeg(rendered)
        if (await putJpegThumbnail(adapter, canvasId, jpeg)) return true
      } catch (error) {
        console.warn('[Cloud] Failed to encode rendered thumbnail:', error)
      }
    }
  }

  // 2) Fall back to Figma-style embedded thumbnail.png inside the .fig ZIP.
  if (options.figBytes) {
    if (await uploadFigThumbnail(adapter, canvasId, options.figBytes)) return true
  }

  // Blank placeholders are local-UI only — never promote them to shared storage.
  // `allowBlankPlaceholder` is intentionally ignored (deprecated).
  return false
}

/** Build a blob: URL for card display; caller must revoke. */
export function thumbnailBytesToObjectUrl(bytes: Uint8Array, mimeType = 'image/jpeg'): string {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return URL.createObjectURL(new Blob([copy], { type: mimeType }))
}
