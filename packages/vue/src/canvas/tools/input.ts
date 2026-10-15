import type { Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

import { startPenInput } from '#vue/canvas/pen/input'
import { startPencilInput } from '#vue/canvas/pencil/input'
import { HAND_GRAB_CURSOR } from '#vue/editor/tool-cursor'
import { startConnectorDraw } from '#vue/shared/input/connector/draw'
import { startShapeDraw, startTextDraw } from '#vue/shared/input/draw'
import { startPanDrag } from '#vue/shared/input/pan/drag'
import { handleSelectDown } from '#vue/shared/input/select'
import type { HitTestFns } from '#vue/shared/input/select'
import { startStickyPlace } from '#vue/shared/input/sticky/place'
import type { DragState } from '#vue/shared/input/types'

type ToolMouseDownOptions = {
  event: MouseEvent
  cx: number
  cy: number
  sx: number
  sy: number
  editor: Editor
  hitFns: HitTestFns
  cursorOverride: Ref<string | null>
  setDrag: (d: DragState) => void
  tryStartRotation: (cx: number, cy: number) => boolean
  handleTextEditClick: (cx: number, cy: number, shiftKey: boolean) => boolean
}

export { startPanDrag }

export function handleToolMouseDown({
  event,
  cx,
  cy,
  sx,
  sy,
  editor,
  hitFns,
  cursorOverride,
  setDrag,
  tryStartRotation,
  handleTextEditClick
}: ToolMouseDownOptions) {
  const tool = editor.state.activeTool

  if (event.button === 1 || tool === 'HAND') {
    startPanDrag(event, setDrag, editor)
    cursorOverride.value = HAND_GRAB_CURSOR
    return
  }

  // Comments are placed by the app's comments layer above the canvas.
  if (tool === 'COMMENT') return

  if (tool === 'SELECT') {
    handleSelectDown(
      event,
      cx,
      cy,
      sx,
      sy,
      editor,
      hitFns,
      tryStartRotation,
      handleTextEditClick,
      setDrag
    )
    return
  }

  if (tool === 'PEN') {
    startPenInput(event, cx, cy, editor, setDrag, cursorOverride)
    return
  }

  if (tool === 'PENCIL') {
    startPencilInput(cx, cy, editor, setDrag)
    return
  }

  if (tool === 'TEXT') {
    startTextDraw(cx, cy, editor, setDrag)
    return
  }

  if (tool === 'CONNECTOR') {
    startConnectorDraw(cx, cy, sx, sy, editor, setDrag)
    return
  }

  if (tool === 'STICKY') {
    startStickyPlace(cx, cy, editor, setDrag)
    return
  }

  startShapeDraw(cx, cy, editor, setDrag)
}
