import { getNodeEditState, handleNodeEditDown } from '#vue/shared/input/vector'
export { resolveHit } from '#vue/shared/input/select/hit'
import { resolveHit } from '#vue/shared/input/select/hit'
export { updateHoverCursor } from '#vue/shared/input/select/hover'
import { editedGradient, type Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

import { tryStartCornerRadiusDrag } from '#vue/shared/input/corner-radius'
import { tryStartGradientDrag } from '#vue/shared/input/gradient'
import { tryStartResize } from '#vue/shared/input/resize'
import {
  createSelectionMoveDrag,
  clickSelectsInside,
  pressesSelection,
  selectionIsLocked
} from '#vue/shared/input/select/move'
import type { DragState } from '#vue/shared/input/types'

export interface HitTestFns {
  hitTestInScope: (cx: number, cy: number, deep: boolean) => SceneNode | null
  isInsideContainerBounds: (cx: number, cy: number, containerId: string) => boolean
  hitTestSectionTitle: (cx: number, cy: number) => SceneNode | null
  hitTestComponentLabel: (cx: number, cy: number) => SceneNode | null
  hitTestFrameTitle: (cx: number, cy: number) => SceneNode | null
}

/** Clears the selection and starts a marquee in the open frame or section under the press. */
function startMarquee(cx: number, cy: number, editor: Editor, setDrag: (d: DragState) => void) {
  editor.clearSelection()
  const container = editor.graph.hitTestOpenContainer(cx, cy, editor.state.currentPageId)
  setDrag({ type: 'marquee', startX: cx, startY: cy, containerId: container?.id })
}

/**
 * Starts dragging a gradient handle, or else the selection's corner radius, rotation, or resize
 * handles.
 */
function tryStartHandleDrag(
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  altKey: boolean,
  editor: Editor,
  tryStartRotation: (cx: number, cy: number) => boolean,
  setDrag: (d: DragState) => void
): boolean {
  if (tryStartGradientDrag(editor, sx, sy, setDrag)) return true
  // An open gradient's handles replace the layer's selection handles, which then do not respond.
  if (editedGradient(editor.graph, editor.state.gradientEdit)) return false
  if (tryStartCornerRadiusDrag(editor, sx, sy, altKey, setDrag)) return true
  if (tryStartRotation(cx, cy)) return true
  const resizeDrag = tryStartResize(cx, cy, editor)
  if (resizeDrag) setDrag(resizeDrag)
  return resizeDrag !== null
}

export function handleSelectDown(
  e: MouseEvent,
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  editor: Editor,
  fns: HitTestFns,
  tryStartRotation: (cx: number, cy: number) => boolean,
  handleTextEditClick: (cx: number, cy: number, shiftKey: boolean) => boolean,
  setDrag: (d: DragState) => void
) {
  // Node edit mode intercept
  if (getNodeEditState(editor)) {
    handleNodeEditDown(e, cx, cy, editor, setDrag)
    return
  }

  if (editor.state.editingTextId && handleTextEditClick(cx, cy, e.shiftKey)) return

  if (editor.state.editingTextId) editor.commitTextEdit()

  if (tryStartHandleDrag(cx, cy, sx, sy, e.altKey, editor, tryStartRotation, setDrag)) return

  const hit = resolveHit(cx, cy, editor, fns, e.metaKey || e.ctrlKey)
  if (!hit) {
    if (!editor.state.enteredContainerId) startMarquee(cx, cy, editor, setDrag)
    return
  }

  const keepsSelection = !e.shiftKey && pressesSelection(hit, cx, cy, editor)
  if (!editor.state.selectedIds.has(hit.id) && !e.shiftKey && !keepsSelection) {
    editor.select([hit.id])
  } else if (e.shiftKey) {
    editor.select([hit.id], true)
  }

  if (selectionIsLocked(editor)) return

  const drag = createSelectionMoveDrag(cx, cy, sx, sy, editor, e.altKey)
  // A click without dragging still selects a layer inside a selected frame; groups need a double-click.
  if (drag.type === 'move' && keepsSelection && !editor.state.selectedIds.has(hit.id)) {
    drag.selectOnClick = clickSelectsInside(hit, editor) ? hit.id : undefined
  }
  setDrag(drag)
}
