import { watch } from 'vue'

import type { useCollabInjected } from '@/app/collab/use'
import type { EditorStore } from '@/app/editor/active-store'

type Collaboration = ReturnType<typeof useCollabInjected>

export function useCanvasCollaborationAwareness(store: EditorStore, collab: Collaboration) {
  function updateCursor(cx: number, cy: number) {
    store.state.cursorCanvasX = cx
    store.state.cursorCanvasY = cy
    collab?.updateCursor(cx, cy, store.state.currentPageId)
  }

  watch(
    () => [...store.state.selectedIds],
    (ids) => collab?.updateSelection(ids)
  )

  return { updateCursor }
}
