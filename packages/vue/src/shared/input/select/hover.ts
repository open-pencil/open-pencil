import {
  buildResizeCursor,
  cornerRotationCursor,
  getHitHandleByMatrix,
  hitTestCornerRotationByMatrix
} from '#vue/shared/input/geometry'
import { getNodeEditState } from '#vue/shared/input/node-edit'

import { getAbsoluteRotation } from '@open-pencil/core/canvas'

import type { HitTestFns } from '#vue/shared/input/select'
import type { Editor } from '@open-pencil/core/editor'

function getResizeCursorForSelection(cx: number, cy: number, editor: Editor): string | null {
  for (const id of editor.state.selectedIds) {
    const node = editor.graph.getNode(id)
    if (!node) continue

    const handleHit = getHitHandleByMatrix(cx, cy, node, editor.graph, editor.renderer?.zoom ?? 1)
    if (handleHit?.handle) return buildResizeCursor(handleHit.rotation)
  }
  return null
}

function getRotationCursorForSelection(cx: number, cy: number, editor: Editor): string | null {
  if (editor.state.selectedIds.size !== 1) return null

  const id = [...editor.state.selectedIds][0]
  const node = editor.graph.getNode(id)
  if (!node) return null

  const corner = hitTestCornerRotationByMatrix(cx, cy, node, editor.graph, editor.renderer?.zoom ?? 1)
  if (!corner) return null

  const absoluteRotation = getAbsoluteRotation(node, editor.graph)
  return cornerRotationCursor(corner, absoluteRotation)
}

function updateHoveredNode(
  cx: number,
  cy: number,
  editor: Editor,
  fns: Pick<HitTestFns, 'hitTestInScope' | 'hitTestSectionTitle' | 'hitTestComponentLabel'>
) {
  const hit =
    fns.hitTestSectionTitle(cx, cy) ??
    fns.hitTestComponentLabel(cx, cy) ??
    fns.hitTestInScope(cx, cy, false)
  const editNodeId = getNodeEditState(editor)?.nodeId
  editor.setHoveredNode(
    hit && !editor.state.selectedIds.has(hit.id) && hit.id !== editNodeId ? hit.id : null
  )
}

export function updateHoverCursor(
  cx: number,
  cy: number,
  editor: Editor,
  fns: Pick<HitTestFns, 'hitTestInScope' | 'hitTestSectionTitle' | 'hitTestComponentLabel'>
): string | null {
  if (getNodeEditState(editor)) {
    editor.setHoveredNode(null)
    return null
  }

  const cursor =
    getResizeCursorForSelection(cx, cy, editor) ?? getRotationCursorForSelection(cx, cy, editor)
  updateHoveredNode(cx, cy, editor, fns)
  return cursor
}
