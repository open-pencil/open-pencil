import type { EditorStore } from '@/app/editor/session'

import {
  recentDocumentIdOf,
  recentDocumentView,
  rememberRecentDocumentView,
  type RecentDocumentView
} from './store'

type ViewedDocument = Pick<
  EditorStore,
  'graph' | 'state' | 'getDocumentFilePath' | 'getStorageBinding' | 'getViewportSize'
>

function recentIdOf(store: ViewedDocument): string | null {
  return recentDocumentIdOf(store.getDocumentFilePath(), store.getStorageBinding())
}

/** Keeps the page and view a tab shows its document at, for the document's next open. */
export function rememberDocumentView(store: ViewedDocument): void {
  const id = recentIdOf(store)
  if (!id) return
  const { width, height } = store.getViewportSize()
  const { panX, panY, zoom, currentPageId } = store.state
  if (width <= 0 || height <= 0 || zoom <= 0) return
  const center = { x: (width / 2 - panX) / zoom, y: (height / 2 - panY) / zoom }
  // A view too far out to store as a number opens fitted instead.
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) return
  rememberRecentDocumentView(id, { pageId: currentPageId, center, zoom })
}

/**
 * The view the document was left at, when one was kept and its page is still one of the document's
 * visible pages; an internal page an automation left current opens the first page instead.
 */
export function rememberedDocumentView(store: ViewedDocument): RecentDocumentView | null {
  const id = recentIdOf(store)
  const view = id ? recentDocumentView(id) : null
  if (!view || !store.graph.getPages().some((page) => page.id === view.pageId)) return null
  return view
}
