import type { Editor } from '@open-pencil/core'

import { findEnclosingDrawParent } from '#vue/shared/input/drop-target'
import type { DragState } from '#vue/shared/input/types'

export function startPencilInput(
  cx: number,
  cy: number,
  editor: Editor,
  setDrag: (drag: DragState) => void
) {
  editor.pencilBegin(cx, cy)
  setDrag({ type: 'pencil-drag' })
}

/** Holding Shift draws on straight from where it was pressed, horizontally or vertically. */
export function handlePencilDragMove(cx: number, cy: number, shiftKey: boolean, editor: Editor) {
  editor.pencilAddPoint(cx, cy, shiftKey)
}

/** Adds the stroke to the frame that holds all of it, or to the page. */
export function finishPencilDrag(editor: Editor) {
  const points = editor.state.pencilState?.points
  if (!points || points.length === 0) {
    editor.pencilCancel()
    return
  }
  editor.pencilCommit(findEnclosingDrawParent(points, 'VECTOR', editor))
}
