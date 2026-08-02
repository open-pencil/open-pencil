import { documentKindRules } from '@open-pencil/core/editor'

import type { useCollabInjected } from '@/app/collab/use'
import type { EditorStore } from '@/app/editor/active-store'

type Collaboration = ReturnType<typeof useCollabInjected>

export function useCanvasCollaborationAwareness(store: EditorStore, collab: Collaboration) {
  /**
   * Slides mode broadcasts nothing.
   *
   * Checked per call rather than once at setup: the same canvas host serves whichever
   * document is active, so the answer changes when the user switches tabs between a design
   * file and a deck.
   */
  const collaborative = () => documentKindRules(store.state.documentKind).collaborative

  function updateCursor(cx: number, cy: number) {
    store.state.cursorCanvasX = cx
    store.state.cursorCanvasY = cy
    if (!collaborative()) return
    collab?.updateCursor(cx, cy, store.state.currentPageId)
  }

  store.onEditorEvent('selection:changed', (ids) => {
    if (!collaborative()) return
    collab?.updateSelection(ids)
  })

  return { updateCursor }
}
