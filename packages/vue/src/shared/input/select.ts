import { getNodeEditState, handleNodeEditDown } from '#vue/shared/input/vector'
export { resolveHit } from '#vue/shared/input/select/hit'
import { hitTestLabel, resolveHit, tinySelectionAt } from '#vue/shared/input/select/hit'
export { updateHoverCursor } from '#vue/shared/input/select/hover'
import { editedGradient, type Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

import { tryStartGradientDrag } from '#vue/shared/input/gradient'
import { tryStartResize } from '#vue/shared/input/resize'
import {
  createSelectionMoveDrag,
  clickSelectsInside,
  pressesSelection,
  selectionIsLocked
} from '#vue/shared/input/select/move'
import { tryStartShapeHandleDrag } from '#vue/shared/input/shape-handles'
import { tryStartStickyScale } from '#vue/shared/input/sticky/scale'
import type { DragState } from '#vue/shared/input/types'

export interface HitTestFns {
  hitTestInScope: (cx: number, cy: number, deep: boolean) => SceneNode | null
  isInsideContainerBounds: (cx: number, cy: number, containerId: string) => boolean
  hitTestSectionTitle: (cx: number, cy: number) => SceneNode | null
  hitTestComponentLabel: (cx: number, cy: number) => SceneNode | null
  hitTestFrameTitle: (cx: number, cy: number) => SceneNode | null
}

/** Leaves entered containers, innermost first, until one holds the point or none is entered. */
function exitContainersOutside(cx: number, cy: number, editor: Editor, fns: HitTestFns) {
  let entered = editor.state.enteredContainerId
  while (entered && !fns.isInsideContainerBounds(cx, cy, entered)) {
    editor.exitContainer()
    if (editor.state.enteredContainerId === entered) return
    entered = editor.state.enteredContainerId
  }
}

/**
 * Starts a marquee from a press on empty space, as in Figma: inside an entered group or frame it
 * selects among that container's layers, and elsewhere among the layers of the open frame or
 * section under the press, or of the page. Entered containers the press is outside are left first.
 */
export function startMarquee(
  cx: number,
  cy: number,
  editor: Editor,
  fns: HitTestFns,
  setDrag: (d: DragState) => void
) {
  exitContainersOutside(cx, cy, editor, fns)
  editor.clearSelection()
  const container = editor.state.enteredContainerId
    ? undefined
    : editor.graph.hitTestOpenContainer(cx, cy, editor.state.currentPageId)
  setDrag({ type: 'marquee', startX: cx, startY: cy, containerId: container?.id })
}

/**
 * Starts dragging a gradient handle, or else the selection's corner radius, resize, or rotation
 * handles. A layer's label takes the press before rotation but after resizing, as in Figma.
 */
function tryStartHandleDrag(
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  altKey: boolean,
  editor: Editor,
  fns: HitTestFns,
  tryStartRotation: (cx: number, cy: number) => boolean,
  setDrag: (d: DragState) => void
): boolean {
  if (tryStartGradientDrag(editor, sx, sy, setDrag)) return true
  // An open gradient's handles replace the layer's selection handles, which then do not respond.
  if (editedGradient(editor.graph, editor.state.gradientEdit)) return false
  if (tryStartShapeHandleDrag(editor, sx, sy, altKey, setDrag)) return true
  const scaleDrag = tryStartStickyScale(cx, cy, editor)
  if (scaleDrag) {
    setDrag(scaleDrag)
    return true
  }
  const resizeDrag = tryStartResize(cx, cy, editor)
  if (resizeDrag) {
    setDrag(resizeDrag)
    return true
  }
  return !hitTestLabel(cx, cy, fns) && tryStartRotation(cx, cy)
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

  if (tryStartHandleDrag(cx, cy, sx, sy, e.altKey, editor, fns, tryStartRotation, setDrag)) return

  const hit =
    tinySelectionAt(cx, cy, editor) ?? resolveHit(cx, cy, editor, fns, e.metaKey || e.ctrlKey)
  if (!hit) {
    startMarquee(cx, cy, editor, fns, setDrag)
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
