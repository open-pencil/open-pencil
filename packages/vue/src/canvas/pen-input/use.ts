import type { Ref } from 'vue'

import { PEN_CLOSE_THRESHOLD } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'

import { createPenDrag, handlePenDragMove } from '#vue/canvas/pen-input/drag'
import { handlePenNodeEditDown } from '#vue/shared/input/node-edit'
import type { DragState } from '#vue/shared/input/types'

type SetDrag = (drag: DragState) => void

export function startPenInput(
  e: MouseEvent,
  cx: number,
  cy: number,
  editor: Editor,
  setDrag: SetDrag,
  cursorOverride: Ref<string | null>
): boolean {
  editor.state.penCursorX = null
  editor.state.penCursorY = null

  const nodeEditState = editor.state.nodeEditState
  if (nodeEditState) {
    handlePenNodeEditDown(e, cx, cy, editor)
    return true
  }

  const penState = editor.state.penState
  if (penState && penState.vertices.length > 2) {
    const first = penState.vertices[0]
    const dist = Math.hypot(cx - first.x, cy - first.y)
    if (dist < PEN_CLOSE_THRESHOLD) {
      editor.penSetPendingClose(true)
      editor.penSetClosingToFirst(true)
      setDrag(createPenDrag(first.x, first.y))
      cursorOverride.value = 'crosshair'
      return true
    }
  }

  editor.penSetPendingClose(false)
  editor.penAddVertex(cx, cy)
  setDrag(createPenDrag(cx, cy))
  cursorOverride.value = 'crosshair'
  return true
}

export function updatePenHover(cx: number, cy: number, editor: Editor): boolean {
  if (editor.state.activeTool !== 'PEN' || !editor.state.penState) return false
  editor.state.penCursorX = cx
  editor.state.penCursorY = cy

  const first = editor.state.penState.vertices[0]
  if (editor.state.penState.vertices.length > 2) {
    const dist = Math.hypot(cx - first.x, cy - first.y)
    editor.penSetClosingToFirst(dist < PEN_CLOSE_THRESHOLD)
  }
  editor.requestRepaint()
  return true
}

export { handlePenDragMove }
