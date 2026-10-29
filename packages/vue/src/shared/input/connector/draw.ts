import type { AttachModifiers, Editor } from '@open-pencil/core'

import { isPastPointerDragThreshold } from '#vue/shared/input/drag-threshold'
import type { DragConnectorDraw, DragState } from '#vue/shared/input/types'

/** How the keys held on a pointer or key event change where a connector end attaches. */
export function attachModifiers(
  e: Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey'>
): AttachModifiers {
  return { pin: e.metaKey || e.ctrlKey, centre: e.shiftKey }
}

/** Starts a connector at the press, or ends the one a click started, as FigJam's tool does. */
export function startConnectorDraw(
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  editor: Editor,
  setDrag: (drag: DragState) => void,
  modifiers: AttachModifiers
) {
  editor.connectorBegin(cx, cy, modifiers)
  const drag: DragConnectorDraw = {
    type: 'connector-draw',
    startSX: sx,
    startSY: sy,
    moved: false,
    x: cx,
    y: cy,
    modifiers,
    commit: () => editor.connectorRelease(drag.x, drag.y, drag.moved, drag.modifiers),
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
  editor: Editor,
  modifiers: AttachModifiers
) {
  drag.x = cx
  drag.y = cy
  drag.modifiers = modifiers
  drag.moved ||= isPastPointerDragThreshold(drag.startSX, drag.startSY, sx, sy)
  if (drag.moved) editor.connectorDrag(cx, cy, modifiers)
}

/** The keys that change where a connector end attaches: Shift centres it, ⌘ or Ctrl pins it. */
const CONNECTOR_KEYS = new Set(['Shift', 'Meta', 'Control'])

/**
 * A key pressed or let go mid-drag changes where a drawn or dragged connector end attaches at
 * once, at the last pointer position, so a release without a move after it attaches by it.
 */
export function refreshConnectorDrag(
  drag: DragState | null,
  pointer: { cx: number; cy: number; sx: number; sy: number } | null,
  e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey'>,
  editor: Editor
) {
  if (!drag || !pointer || !CONNECTOR_KEYS.has(e.key)) return
  const { cx, cy, sx, sy } = pointer
  if (drag.type === 'connector-draw') {
    handleConnectorDrawMove(drag, cx, cy, sx, sy, editor, attachModifiers(e))
  } else if (drag.type === 'connector-end') {
    editor.connectorEndpointDrag(cx, cy, attachModifiers(e))
  }
}
