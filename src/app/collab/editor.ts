import type { CollabEditor } from '@open-pencil/collab'

import type { EditorStore } from '@/app/editor/active-store'

/** A tab's editor as its room sees it. */
export function collabEditor(store: EditorStore): CollabEditor {
  return {
    get graph() {
      return store.graph
    },
    isReadOnly: () => store.state.hostRestrictions.readOnly,
    onEditorEvent: store.onEditorEvent,
    requestRender: () => store.requestRender(),
    refreshVariables: (scope) => store.refreshVariables(scope),
    refreshDocumentSettings: () => store.refreshDocumentSettings()
  }
}

/**
 * Moves the tab to one of the room's pages when the page it shows is gone, as after a peer deleted
 * it or the tab dropped its file's own pages for the room's.
 */
export function followRoomPages(store: EditorStore): () => void {
  let pending: string | undefined
  return () => {
    const pages = store.graph.getPages()
    if (pages.length === 0 || pages.some((page) => page.id === store.state.currentPageId)) return
    const pageId = pages[0].id
    if (pending === pageId) return
    pending = pageId
    void store
      .switchPage(pageId)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('[Collab] Failed to switch to a synced page:', error)
      })
      .finally(() => {
        if (pending === pageId) pending = undefined
      })
  }
}
