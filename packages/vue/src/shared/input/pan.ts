import type { DragState } from '#vue/shared/input/types'
import type { Editor } from '@open-pencil/core/editor'

export function startPanDrag(event: MouseEvent, setDrag: (d: DragState) => void, editor: Editor) {
  setDrag({
    type: 'pan',
    startScreenX: event.clientX,
    startScreenY: event.clientY,
    startPanX: editor.state.panX,
    startPanY: editor.state.panY
  })
}
