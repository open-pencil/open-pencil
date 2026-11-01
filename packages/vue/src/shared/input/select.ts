import { getNodeEditState, handleNodeEditDown } from '#vue/shared/input/vector'
export { resolveHit } from '#vue/shared/input/select/hit'
import { hitTestLabel, resolveHit, tinySelectionAt } from '#vue/shared/input/select/hit'
export { updateHoverCursor } from '#vue/shared/input/select/hover'
import { editedGradient, resolveEditorProfile, type Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'

import { tryStartConnectorEndDrag } from '#vue/shared/input/connector/end'
import { tryStartConnectorLineDrag } from '#vue/shared/input/connector/line'
import { tryStartGradientDrag } from '#vue/shared/input/gradient'
import { tryStartLineEndDrag } from '#vue/shared/input/line/end'
import { tryStartResize } from '#vue/shared/input/resize'
import {
  createSelectionMoveDrag,
  pressSelects,
  selectionIsLocked
} from '#vue/shared/input/select/move'
import { tryStartShapeHandleDrag } from '#vue/shared/input/shape-handles'
import { tryStartStickyScale } from '#vue/shared/input/sticky/scale'
import type { DragState } from '#vue/shared/input/types'

export interface HitTestFns {
  hitTestLayer: (cx: number, cy: number, deep: boolean) => SceneNode | null
  hitTestSectionTitle: (cx: number, cy: number) => SceneNode | null
  hitTestComponentLabel: (cx: number, cy: number) => SceneNode | null
  hitTestFrameTitle: (cx: number, cy: number) => SceneNode | null
}

/**
 * A press on nothing: leaves any entered container, clears the selection, and starts a marquee in
 * the open frame or section under the press. Without a drag it selects that section only when
 * nothing was selected; with a selection it only deselects, as in Figma.
 */
function startMarquee(cx: number, cy: number, editor: Editor, setDrag: (d: DragState) => void) {
  const selectsSection = editor.state.selectedIds.size === 0
  editor.exitContainers()
  editor.clearSelection()
  const container = editor.graph.hitTestOpenContainer(cx, cy, editor.state.currentPageId)
  setDrag({ type: 'marquee', startX: cx, startY: cy, containerId: container?.id, selectsSection })
}

/**
 * Starts dragging a gradient handle, or else the selection's corner radius, resize, or rotation
 * handles. A layer's label takes the press before rotation but after resizing, as in Figma; a
 * read-only document has no handles.
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
  if (!resolveEditorProfile(editor.state).edits) return false
  if (tryStartGradientDrag(editor, sx, sy, setDrag)) return true
  // An open gradient's handles replace the layer's selection handles, which then do not respond.
  if (editedGradient(editor.graph, editor.state.gradientEdit)) return false
  if (tryStartShapeHandleDrag(editor, sx, sy, altKey, setDrag)) return true
  if (tryStartConnectorEndDrag(editor, sx, sy, setDrag)) return true
  if (tryStartConnectorLineDrag(editor, cx, cy, sx, sy, setDrag)) return true
  if (tryStartLineEndDrag(editor, cx, cy, setDrag)) return true
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

/**
 * Shift adds to the selection; a plain press selects the layer when the press selects it and
 * enters the container it was reached through, so Escape, pasting, and the marquee follow it.
 */
function selectOnPress(hit: SceneNode, shiftKey: boolean, selects: boolean, editor: Editor) {
  if (shiftKey) {
    editor.select([hit.id], true)
    return
  }
  if (!selects) return
  if (!editor.state.selectedIds.has(hit.id)) editor.select([hit.id])
  editor.enterContainerOf(hit.id)
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

  const deep = e.metaKey || e.ctrlKey
  const hit = tinySelectionAt(cx, cy, editor) ?? resolveHit(cx, cy, fns, deep)
  if (!hit) {
    startMarquee(cx, cy, editor, setDrag)
    return
  }

  selectOnPress(hit, e.shiftKey, pressSelects(hit, cx, cy, editor, deep), editor)

  // A read-only document moves nothing.
  if (!resolveEditorProfile(editor.state).edits) return
  if (selectionIsLocked(editor)) return

  // A press inside the selection drags it; its layers are a double-click or ⌘-click away, as in Figma.
  setDrag(createSelectionMoveDrag(cx, cy, sx, sy, editor, e.altKey))
}
