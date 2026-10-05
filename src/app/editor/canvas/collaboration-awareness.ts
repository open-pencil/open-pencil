import { roomForStore } from '@/app/collab/rooms'
import type { EditorStore } from '@/app/editor/active-store'

/** Publishes a canvas's cursor and selection to the room its own tab is in, and no other. */
export function useCanvasCollaborationAwareness(store: EditorStore) {
  function updateCursor(cx: number, cy: number) {
    store.state.cursorCanvasX = cx
    store.state.cursorCanvasY = cy
    roomForStore(store)?.updateCursor(cx, cy, store.state.currentPageId)
  }

  store.onEditorEvent('selection:changed', (ids) => roomForStore(store)?.updateSelection(ids))

  return { updateCursor }
}
