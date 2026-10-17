import type { DBSchema } from 'idb'

import { extractFigThumbnailFromReader } from '@open-pencil/fig'

import { readCacheBytes, removeCachePrefix, writeCacheBytes } from '@/app/cache'
import { usablePreview } from '@/app/document/io/preview-bytes'
import {
  APP_DATABASE_NAMES,
  binaryStorage,
  connectAppDatabase,
  defineAppDatabase,
  readStoredBinary,
  type StoredBinary
} from '@/app/storage/idb'
import { isTauri } from '@/app/tauri/env'

interface RecentPreviewDatabase extends DBSchema {
  preview: { key: string; value: StoredBinary }
}

/** The browser has no app cache directory, so recent-file previews live in IndexedDB there. */
const recentPreviewDatabase = connectAppDatabase(
  defineAppDatabase<RecentPreviewDatabase>({
    name: APP_DATABASE_NAMES.recentPreviews,
    version: 1,
    callbacks: {
      upgrade(database) {
        if (!database.objectStoreNames.contains('preview')) database.createObjectStore('preview')
      }
    }
  })
)

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
  if (!isTauri()) {
    try {
      const database = await recentPreviewDatabase.open()
      return usablePreview(await readStoredBinary(await database.get('preview', path)))
    } catch (error) {
      console.warn('[Recent files] Could not read the preview database', error)
      return null
    }
  }
  const bytes = await readCacheBytes(await recentFileThumbnailCacheKey(path))
  return bytes ? usablePreview(new Uint8Array(bytes)) : null
}

export async function cacheRecentFileThumbnail(path: string, bytes: Uint8Array): Promise<void> {
  const preview = usablePreview(bytes)
  if (!preview) return
  if (!isTauri()) {
    try {
      // Taken before the transaction opens, as an IndexedDB write may not await in between.
      const storeBinary = await binaryStorage()
      const database = await recentPreviewDatabase.open()
      await database.put('preview', storeBinary(preview), path)
    } catch (error) {
      console.warn('[Recent files] Could not save the preview', error)
    }
    return
  }
  await writeCacheBytes(await recentFileThumbnailCacheKey(path), Uint8Array.from(preview).buffer)
}

export async function clearRecentFileThumbnails(): Promise<void> {
  if (!isTauri()) {
    try {
      await (await recentPreviewDatabase.open()).clear('preview')
    } catch (error) {
      console.warn('[Recent files] Could not clear the preview database', error)
    }
    return
  }
  await removeCachePrefix(RECENT_FILE_THUMBNAIL_CACHE_DIR)
}

export async function loadRecentFileThumbnail(path: string): Promise<Uint8Array | null> {
  const cached = await loadCachedRecentFileThumbnail(path)
  if (cached || !isTauri() || !path.toLowerCase().endsWith('.fig')) return cached
  const { open, SeekMode } = await import('@tauri-apps/plugin-fs')
  const file = await open(path, { read: true })
  try {
    const info = await file.stat()
    const embedded = await extractFigThumbnailFromReader({
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
    return embedded
  } finally {
    await file.close()
  }
}
