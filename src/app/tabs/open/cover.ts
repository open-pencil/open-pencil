import { promiseTimeout } from '@vueuse/core'

import { figThumbnailPageId } from '@open-pencil/core/io/formats/fig'

import type { EditorStore } from '@/app/editor/session'
import { cacheRecentFileCover, loadCachedRecentFileThumbnail } from '@/app/recent-files'

/** Per open `.fig` document, stops listening for its cover page to show. */
const coverThumbnailListeners = new WeakMap<EditorStore, () => void>()

async function cacheOpenedFigCover(path: string, store: EditorStore): Promise<void> {
  if (await loadCachedRecentFileThumbnail(path)) return
  // A document without a page has no cover, so it never waits for a renderer.
  if (!figThumbnailPageId(store.graph.getPages())) return
  for (let attempt = 0; attempt < 240 && !store.renderer; attempt++) {
    await promiseTimeout(250)
  }
  const renderer = store.renderer
  if (!renderer) {
    console.warn('[Recent files] Thumbnail skipped because the renderer was unavailable')
    return
  }
  if (!(await cacheRecentFileCover(path, store.graph, renderer))) {
    console.warn('[Recent files] Thumbnail skipped because its page was empty')
  }
}

/** Caches the cover of a `.fig` file a tab shows, unless Recent files already has it. */
export function refreshOpenedFigCover(path: string, store: EditorStore): void {
  void cacheOpenedFigCover(path, store).catch((error) => {
    console.warn('[Recent files] Failed to cache the thumbnail', error)
  })
}

/** Caches a `.fig` file's cover again each time its tab shows the cover page. */
export function watchOpenedFigCover(path: string, store: EditorStore): void {
  coverThumbnailListeners.get(store)?.()
  const thumbnailPageId = figThumbnailPageId(store.graph.getPages())
  if (!thumbnailPageId) return
  coverThumbnailListeners.set(
    store,
    store.onEditorEvent('page:changed', (pageId) => {
      if (pageId !== thumbnailPageId) return
      refreshOpenedFigCover(path, store)
    })
  )
}

/** Stops caching the cover of the document `store` shows, as its tab goes. */
export function forgetOpenedFigCover(store: EditorStore): void {
  coverThumbnailListeners.get(store)?.()
  coverThumbnailListeners.delete(store)
}
