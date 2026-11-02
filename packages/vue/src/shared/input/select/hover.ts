import { resolveEditorProfile, type Editor } from '@open-pencil/core'
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
import { pressSelects } from '#vue/shared/input/select/move'
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

function updateHoveredNode(
  cx: number,
  cy: number,
  editor: Editor,
  fns: Pick<
    HitTestFns,
    'hitTestLayer' | 'hitTestFrameTitle' | 'hitTestSectionTitle' | 'hitTestComponentLabel'
  >,
  deep: boolean
) {
  // A label takes the hover before the layers under it, with or without ⌘, as it takes a press.
  const hit = hitTestLabel(cx, cy, fns) ?? fns.hitTestLayer(cx, cy, deep)
  const editNodeId = getNodeEditState(editor)?.nodeId
  // No outline on a layer a press would not select.
  const hovered =
    hit &&
    !editor.state.selectedIds.has(hit.id) &&
    hit.id !== editNodeId &&
    pressSelects(hit, cx, cy, editor, deep)
  editor.setHoveredNode(hovered ? hit.id : null)
}

export function updateHoverCursor(
  cx: number,
  cy: number,
  editor: Editor,
  fns: Pick<
    HitTestFns,
    'hitTestLayer' | 'hitTestFrameTitle' | 'hitTestSectionTitle' | 'hitTestComponentLabel'
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
