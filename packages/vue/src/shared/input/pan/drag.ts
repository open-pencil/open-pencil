import type { Editor } from '@open-pencil/core'

import type { DragState } from '#vue/shared/input/types'

export function startPanDrag(event: MouseEvent, setDrag: (d: DragState) => void, editor: Editor) {
  // A press starts a navigation generation, so tiles queued for the view the drag leaves go.
  editor.setNavigationPhase('pan', performance.now())
  setDrag({
    type: 'pan',
    startScreenX: event.clientX,
    startScreenY: event.clientY,
    startPanX: editor.state.panX,
    startPanY: editor.state.panY
  })
}
