import { stat, open, SeekMode } from '@tauri-apps/plugin-fs'
import { isEqual } from 'es-toolkit'
import * as v from 'valibot'

import type { Editor } from '@open-pencil/core'
import { figThumbnailPageId } from '@open-pencil/core/io/formats/fig'
import { renderThumbnail } from '@open-pencil/core/io/formats/raster'
import { extractFigThumbnailFromReader } from '@open-pencil/fig'
import type { SceneGraph } from '@open-pencil/scene-graph'

import {
  readCacheBytes,
  readCacheJSON,
  removeCachePrefix,
  writeCacheBytes,
  writeCacheJSON
} from '@/app/cache'
import { isFigArchiveName } from '@/app/document/io/names'
import { isTauri } from '@/app/tauri/env'

// One entry per file: its cover and the size and time of the file it was drawn for. v4 holds
// 800×450 covers; older ones are drawn again when a file next opens.
const RECENT_FILE_THUMBNAIL_CACHE_DIR = 'recent-file-thumbnails/v4'

const coverFingerprintSchema = v.strictObject({ size: v.number(), mtime: v.number() })
type CoverFingerprint = v.InferOutput<typeof coverFingerprintSchema>

/** The file's size and time now; null when they cannot be read, so nothing cached matches. */
async function fileFingerprint(path: string): Promise<CoverFingerprint | null> {
  try {
    const info = await stat(path)
    return { size: info.size, mtime: info.mtime?.getTime() ?? 0 }
  } catch (error) {
    console.warn('[Recent files] Could not stat the file for thumbnail caching', error)
    return null
  }
}

async function coverEntry(path: string): Promise<{ image: string; fingerprint: string }> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(path))
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  const base = `${RECENT_FILE_THUMBNAIL_CACHE_DIR}/${hash}`
  return { image: `${base}.png`, fingerprint: `${base}.json` }
}

export async function loadCachedRecentFileThumbnail(path: string): Promise<Uint8Array | null> {
  if (!isTauri()) return null
  const [entry, current] = await Promise.all([coverEntry(path), fileFingerprint(path)])
  if (!current) return null
  const cached = await readCacheJSON(entry.fingerprint, coverFingerprintSchema)
  if (!cached || !isEqual(cached, current)) return null
  const bytes = await readCacheBytes(entry.image)
  return bytes ? new Uint8Array(bytes) : null
}

/** Caches `bytes` as the file's cover, drawn for the file as `fingerprint` describes it. */
async function writeCover(
  path: string,
  bytes: Uint8Array,
  fingerprint: CoverFingerprint
): Promise<void> {
  const entry = await coverEntry(path)
  await writeCacheBytes(entry.image, Uint8Array.from(bytes).buffer)
  await writeCacheJSON(entry.fingerprint, fingerprint)
}

export async function cacheRecentFileThumbnail(path: string, bytes: Uint8Array): Promise<void> {
  if (!isTauri()) return
  const fingerprint = await fileFingerprint(path)
  if (fingerprint) await writeCover(path, bytes, fingerprint)
}

/**
 * A Home card's preview: the whole cover page centred on its colour in the card's 16:9, as Figma's
 * file browser shows it, 800 px wide like Figma's previews so a card stays sharp at 2×.
 */
const RECENT_FILE_COVER = { width: 800, height: 450 }

/** Cover writes still running, by file, so each file's covers are cached in the order drawn. */
const coverWrites = new Map<string, Promise<void>>()

/**
 * Draws the cover page of the document at `path` for its Home card and caches it for the file
 * as it is now, so call it once the file is written. The file is read and the cover drawn and
 * queued at once; caching waits for the file's earlier covers, so the last one drawn is kept.
 * False when there is no page to draw.
 */
export async function cacheRecentFileCover(
  path: string,
  graph: SceneGraph,
  renderer: NonNullable<Editor['renderer']>
): Promise<boolean> {
  if (!isTauri()) return false
  const pageId = figThumbnailPageId(graph.getPages())
  if (!pageId) return false
  const { width, height } = RECENT_FILE_COVER
  const bytes = renderThumbnail(renderer.ck, renderer, graph, pageId, width, height, 'letterbox')
  if (!bytes) return false
  // Read now, for the file this cover was drawn from, but queued at once, so covers keep the
  // order they were drawn in however their reads finish.
  const fingerprint = fileFingerprint(path)
  const previous = coverWrites.get(path) ?? Promise.resolve()
  const write = previous
    .catch(() => undefined)
    .then(() => fingerprint)
    .then((drawnFor) => (drawnFor ? writeCover(path, bytes, drawnFor) : undefined))
  coverWrites.set(path, write)
  try {
    await write
  } finally {
    if (coverWrites.get(path) === write) coverWrites.delete(path)
  }
  return true
}

/** Clears every cover once the writes already queued have landed, so none comes back. */
export async function clearRecentFileThumbnails(): Promise<void> {
  await Promise.allSettled(coverWrites.values())
  await removeCachePrefix(RECENT_FILE_THUMBNAIL_CACHE_DIR)
}

export async function loadRecentFileThumbnail(path: string): Promise<Uint8Array | null> {
  if (!isTauri() || !isFigArchiveName(path)) return null
  const cached = await loadCachedRecentFileThumbnail(path)
  if (cached) return cached
  const file = await open(path, { read: true })
  try {
    const info = await file.stat()
    return await extractFigThumbnailFromReader({
      size: info.size,
      async read(start, endExclusive) {
        await file.seek(start, SeekMode.Start)
        const bytes = new Uint8Array(endExclusive - start)
        let offset = 0
        while (offset < bytes.byteLength) {
          const count = await file.read(bytes.subarray(offset))
          if (count === null) break
          offset += count
        }
        return offset === bytes.byteLength ? bytes : bytes.subarray(0, offset)
      }
    })
  } finally {
    await file.close()
  }
}
