import type { Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

import { startPenInput } from '#vue/canvas/pen-input/use'
import { startShapeDraw, startTextTool } from '#vue/shared/input/draw'
import { startPanDrag } from '#vue/shared/input/pan'
import { handleSelectDown } from '#vue/shared/input/select'
import type { HitTestFns } from '#vue/shared/input/select'
import type { DragState } from '#vue/shared/input/types'

type ToolMouseDownOptions = {
  event: MouseEvent
  cx: number
  cy: number
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
    return
  }

  if (tool === 'SELECT') {
    handleSelectDown(event, cx, cy, editor, hitFns, tryStartRotation, handleTextEditClick, setDrag)
    return
  }

  if (tool === 'PEN') {
    startPenInput(event, cx, cy, editor, setDrag, cursorOverride)
    return
  }

  if (tool === 'TEXT') {
    startTextTool(cx, cy, editor)
    return
  }

  startShapeDraw(cx, cy, editor, setDrag)
}
