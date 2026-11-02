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
  rememberRecentDocumentView(id, {
    pageId: currentPageId,
    center: { x: (width / 2 - panX) / zoom, y: (height / 2 - panY) / zoom },
    zoom
  })
}

/** The view the document was left at, when one was kept and its page is still in the document. */
export function rememberedDocumentView(store: ViewedDocument): RecentDocumentView | null {
  const id = recentIdOf(store)
  const view = id ? recentDocumentView(id) : null
  if (!view || store.graph.getNode(view.pageId)?.type !== 'CANVAS') return null
  return view
}
