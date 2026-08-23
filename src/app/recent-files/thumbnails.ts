import { extractFigThumbnailFromReader } from '@open-pencil/fig'

import { readCacheBytes, removeCachePrefix, writeCacheBytes } from '@/app/cache'
import { isTauri } from '@/app/tauri/env'

const RECENT_FILE_THUMBNAIL_CACHE_DIR = 'recent-file-thumbnails/v2'

async function recentFileThumbnailCacheKey(path: string): Promise<string> {
  let fingerprint = path
  try {
    const { stat } = await import('@tauri-apps/plugin-fs')
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

export function clearRecentFileThumbnails(): Promise<void> {
  return removeCachePrefix(RECENT_FILE_THUMBNAIL_CACHE_DIR)
}

export async function loadRecentFileThumbnail(path: string): Promise<Uint8Array | null> {
  if (!isTauri() || !path.toLowerCase().endsWith('.fig')) return null
  const cached = await loadCachedRecentFileThumbnail(path)
  if (cached) return cached
  const { open, SeekMode } = await import('@tauri-apps/plugin-fs')
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
