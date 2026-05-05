import type { Editor } from '@open-pencil/core/editor'

import type { DragState } from '#vue/shared/input/types'

export function startPanDrag(event: MouseEvent, setDrag: (d: DragState) => void, editor: Editor) {
  setDrag({
    type: 'pan',
    startScreenX: event.clientX,
    startScreenY: event.clientY,
    startPanX: editor.state.panX,
    startPanY: editor.state.panY
  })
}
