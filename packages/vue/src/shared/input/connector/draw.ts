import type { Editor } from '@open-pencil/core/editor'

import { isPastPointerDragThreshold } from '#vue/shared/input/drag-threshold'
import type { DragConnectorDraw, DragState } from '#vue/shared/input/types'

/** Starts a connector at the press, or ends the one a click started, as FigJam's tool does. */
export function startConnectorDraw(
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  editor: Editor,
  setDrag: (drag: DragState) => void
) {
  editor.connectorBegin(cx, cy)
  const drag: DragConnectorDraw = {
    type: 'connector-draw',
    startSX: sx,
    startSY: sy,
    moved: false,
    x: cx,
    y: cy,
    commit: () => editor.connectorRelease(drag.x, drag.y, drag.moved),
    cancel: () => editor.connectorCancel()
  }
  setDrag(drag)
}

export function handleConnectorDrawMove(
  drag: DragConnectorDraw,
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  editor: Editor
) {
  drag.x = cx
  drag.y = cy
  drag.moved ||= isPastPointerDragThreshold(drag.startSX, drag.startSY, sx, sy)
  if (drag.moved) editor.connectorDrag(cx, cy)
}
