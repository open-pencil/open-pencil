import { stat, open, SeekMode } from '@tauri-apps/plugin-fs'

import type { Editor } from '@open-pencil/core'
import { figThumbnailPageId } from '@open-pencil/core/io/formats/fig'
import { renderThumbnail } from '@open-pencil/core/io/formats/raster'
import { extractFigThumbnailFromReader } from '@open-pencil/fig'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { readCacheBytes, removeCachePrefix, writeCacheBytes } from '@/app/cache'
import { isFigArchiveName } from '@/app/document/io/names'
import { isTauri } from '@/app/tauri/env'

// v3 holds 1280×720 covers; the 512 px ones of v2 are drawn again when a file next opens.
const RECENT_FILE_THUMBNAIL_CACHE_DIR = 'recent-file-thumbnails/v3'

async function recentFileThumbnailCacheKey(path: string): Promise<string> {
  let fingerprint = path
  try {
    const info = await stat(path)
    fingerprint = `${path}\0${info.size}\0${info.mtime?.getTime() ?? 0}`
  } catch (error) {
    // A path-only key still permits a preview when metadata is unavailable.
    console.warn('[Recent files] Could not stat the file for thumbnail caching', error)
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint))
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return `${RECENT_FILE_THUMBNAIL_CACHE_DIR}/${hash}.png`
}

export async function loadCachedRecentFileThumbnail(path: string): Promise<Uint8Array | null> {
  if (!isTauri()) return null
  const bytes = await readCacheBytes(await recentFileThumbnailCacheKey(path))
  return bytes ? new Uint8Array(bytes) : null
}

export async function cacheRecentFileThumbnail(path: string, bytes: Uint8Array): Promise<void> {
  if (!isTauri()) return
  await writeCacheBytes(await recentFileThumbnailCacheKey(path), Uint8Array.from(bytes).buffer)
}

/**
 * A Home card's preview, framed as the card shows it (16:9 from the content's top left) and sharp
 * at twice the widest card, unlike the 512 px cover a `.fig` carries, which fits its whole page.
 */
const RECENT_FILE_COVER = { width: 1280, height: 720 }

/**
 * Draws the cover page of the document at `path` for its Home card and caches it under the
 * file's current size and time, so call it once the file is written. False when there is no page
 * to draw.
 */
export async function cacheRecentFileCover(
  path: string,
  graph: SceneGraph,
  renderer: NonNullable<Editor['renderer']>
): Promise<boolean> {
  const pageId = figThumbnailPageId(graph.getPages())
  if (!pageId) return false
  const { width, height } = RECENT_FILE_COVER
  const bytes = renderThumbnail(renderer.ck, renderer, graph, pageId, width, height, 'cover')
  if (!bytes) return false
  await cacheRecentFileThumbnail(path, bytes)
  return true
}

export function clearRecentFileThumbnails(): Promise<void> {
  return removeCachePrefix(RECENT_FILE_THUMBNAIL_CACHE_DIR)
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
