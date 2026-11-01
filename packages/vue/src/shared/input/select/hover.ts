import { resolveEditorProfile, type Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import { layerResizes, layerRotates } from '@open-pencil/scene-graph/generated'

import { connectorLineCursor } from '#vue/shared/input/connector/line'
import {
  MOVE_CURSOR,
  buildResizeCursor,
  cornerRotationCursor,
  getHitHandleByMatrix,
  hitTestCornerRotationByMatrix
} from '#vue/shared/input/geometry'
import { lineEndAt } from '#vue/shared/input/line/end'
import type { HitTestFns } from '#vue/shared/input/select'
import { hitTestLabel } from '#vue/shared/input/select/hit'
import { insideSelectedFrame, pressesSelection } from '#vue/shared/input/select/move'
import { scalesByHandles } from '#vue/shared/input/sticky/scale'
import { getNodeEditState } from '#vue/shared/input/vector'

function getResizeCursorForSelection(cx: number, cy: number, editor: Editor): string | null {
  for (const id of editor.state.selectedIds) {
    const node = editor.graph.getNode(id)
    // As a press does: only a layer its handles resize or scale shows a resize cursor on them.
    if (!node || (!layerResizes(node) && !scalesByHandles(node))) continue

    const handleHit = getHitHandleByMatrix(
      cx,
      cy,
      node,
      editor.graph,
      editor.renderer?.zoom ?? 1,
      editor.state.rotationPreview
    )
    if (handleHit?.handle) return buildResizeCursor(handleHit.rotation)
  }
  return null
}

function getRotationCursorForSelection(cx: number, cy: number, editor: Editor): string | null {
  if (editor.state.selectedIds.size !== 1) return null

  const id = [...editor.state.selectedIds][0]
  const node = editor.graph.getNode(id)
  if (!node || !layerRotates(node)) return null

  const corner = hitTestCornerRotationByMatrix(
    cx,
    cy,
    node,
    editor.graph,
    editor.renderer?.zoom ?? 1,
    editor.state.rotationPreview
  )
  if (!corner) return null

  return cornerRotationCursor(corner, node, editor.graph, editor.state.rotationPreview)
}

/**
 * Whether a press on `hit` selects it rather than the selection it lies in: a layer inside a
 * selected frame drags the frame, unless the document is read-only, where nothing drags and the
 * press selects the layer.
 */
function pressSelects(hit: SceneNode, cx: number, cy: number, editor: Editor): boolean {
  if (!pressesSelection(hit, cx, cy, editor)) return true
  return !resolveEditorProfile(editor.state).edits && insideSelectedFrame(hit, editor)
}

function updateHoveredNode(
  cx: number,
  cy: number,
  editor: Editor,
  fns: Pick<
    HitTestFns,
    'hitTestInScope' | 'hitTestFrameTitle' | 'hitTestSectionTitle' | 'hitTestComponentLabel'
  >,
  deep: boolean
) {
  const hit = deep
    ? fns.hitTestInScope(cx, cy, true)
    : (hitTestLabel(cx, cy, fns) ?? fns.hitTestInScope(cx, cy, false))
  const editNodeId = getNodeEditState(editor)?.nodeId
  const hovered =
    hit &&
    !editor.state.selectedIds.has(hit.id) &&
    hit.id !== editNodeId &&
    (deep || pressSelects(hit, cx, cy, editor))
  editor.setHoveredNode(hovered ? hit.id : null)
}

export function updateHoverCursor(
  cx: number,
  cy: number,
  editor: Editor,
  fns: Pick<
    HitTestFns,
    'hitTestInScope' | 'hitTestFrameTitle' | 'hitTestSectionTitle' | 'hitTestComponentLabel'
  >,
  deep = false
): string | null {
  if (getNodeEditState(editor)) {
    editor.setHoveredNode(null)
    return null
  }

  // As a press does: a line's ends, a connector's line handles, then resizing, then a label, then
  // rotation; a read-only document has none.
  const cursor = !resolveEditorProfile(editor.state).edits
    ? null
    : ((lineEndAt(editor, cx, cy) ? MOVE_CURSOR : null) ??
      connectorLineCursor(editor, cx, cy) ??
      getResizeCursorForSelection(cx, cy, editor) ??
      (hitTestLabel(cx, cy, fns) ? null : getRotationCursorForSelection(cx, cy, editor)))
  updateHoveredNode(cx, cy, editor, fns, deep)
  return cursor
}
