import { tryOnScopeDispose } from '@vueuse/core'

import { roomForStore } from '@/app/collab/rooms'
import { getActiveEditorStore, type EditorStore } from '@/app/editor/active-store'

/**
 * Publishes a canvas's cursor and selection to the room its own tab is in, and no other.
 *
 * Canvases read the editor through a proxy that follows the active tab, which no room is keyed
 * by. Every canvas is keyed by its tab, so the tab's own store is the active one while it mounts.
 */
export function useCanvasCollaborationAwareness(store: EditorStore) {
  const tabStore = getActiveEditorStore()

  function updateCursor(cx: number, cy: number) {
    store.state.cursorCanvasX = cx
    store.state.cursorCanvasY = cy
    roomForStore(tabStore)?.updateCursor(cx, cy, tabStore.state.currentPageId)
  }

  const stopSelection = tabStore.onEditorEvent('selection:changed', (ids) =>
    roomForStore(tabStore)?.updateSelection(ids)
  )
  tryOnScopeDispose(stopSelection)

  return { updateCursor }
}
