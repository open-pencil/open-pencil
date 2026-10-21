import { promiseTimeout } from '@vueuse/core'

import { documentThumbnailPageId } from '@open-pencil/core/io/formats/fig'
import { renderThumbnail } from '@open-pencil/core/io/formats/raster'

import { usablePreview } from '@/app/document/io/preview-bytes'
import { DOCUMENT_PREVIEW_SIZE } from '@/app/document/io/preview-render'
import type { EditorStore } from '@/app/editor/session'
import {
  sameStorageLocation,
  storageLocationOf,
  type StorageLocation
} from '@/app/integrations/storage'
import { cacheRecentFileThumbnail, loadCachedRecentFileThumbnail } from '@/app/recent-files'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { saveStoragePreview } from '@/app/storage/workspace/save-preview'

const coverThumbnailListeners = new WeakMap<EditorStore, () => void>()

export function stopWatchingFigCover(store: EditorStore): void {
  coverThumbnailListeners.get(store)?.()
  coverThumbnailListeners.delete(store)
}

async function renderDocumentPreview(store: EditorStore): Promise<Uint8Array | null> {
  const pageId = documentThumbnailPageId(store.graph.getPages())
  if (!pageId) return null
  for (let attempt = 0; attempt < 240 && !store.renderer; attempt++) {
    await promiseTimeout(250)
  }
  const renderer = store.renderer
  if (!renderer) {
    console.warn('[Previews] Preview skipped because the renderer was unavailable')
    return null
  }
  const bytes = renderThumbnail(
    renderer.ck,
    renderer,
    store.graph,
    pageId,
    DOCUMENT_PREVIEW_SIZE,
    DOCUMENT_PREVIEW_SIZE
  )
  if (!bytes) console.warn('[Previews] Preview skipped because the page was empty')
  return usablePreview(bytes)
}

/**
 * Caches the preview of a file opened from disk. On opening, a preview already cached is kept;
 * a refresh after an edit to the page the preview shows draws it again.
 */
export async function cacheOpenedFigCover(
  path: string,
  store: EditorStore,
  refresh = false
): Promise<void> {
  if (!refresh && usablePreview(await loadCachedRecentFileThumbnail(path))) return
  const bytes = await renderDocumentPreview(store)
  if (bytes) await cacheRecentFileThumbnail(path, bytes)
}

/** Draws a preview once for a storage design that has none, then syncs it. */
export async function cacheStorageDocumentPreview(
  location: StorageLocation,
  documentId: string,
  store: EditorStore
): Promise<void> {
  const local = getLocalCanvasStore()
  // A cached preview of the same id may belong to another place, so it is not this design's.
  const meta = await local.getMeta(documentId)
  const own = meta && sameStorageLocation(storageLocationOf(meta), location)
  if (own && usablePreview(await local.readThumb(documentId))) return
  const bytes = await renderDocumentPreview(store)
  if (bytes) await saveStoragePreview(location, documentId, bytes)
}

/** Draws the preview again whenever the page it shows, the cover or else the first page, changes. */
export function watchOpenedFigCover(path: string, store: EditorStore): void {
  coverThumbnailListeners.get(store)?.()
  const previewPageId = documentThumbnailPageId(store.graph.getPages())
  if (!previewPageId) return
  coverThumbnailListeners.set(
    store,
    store.onEditorEvent('page:changed', (pageId) => {
      if (pageId !== previewPageId) return
      void cacheOpenedFigCover(path, store, true).catch((error) => {
        console.warn('[Recent files] Failed to refresh the preview', error)
      })
    })
  )
}
