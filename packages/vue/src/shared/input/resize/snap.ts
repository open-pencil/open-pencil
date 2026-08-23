import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { explicitSnapTargets } from '#vue/shared/input/explicit-snap-targets'
import {
  optionalEditorState,
  resolveObjectPixelSnap,
  worldBoundsNode,
  worldDeltaToParentLocal
} from '#vue/shared/input/snap'
import type { DragResize, HandlePosition } from '#vue/shared/input/types'

function movesLeft(handle: HandlePosition): boolean {
  return handle.includes('w')
}

function movesRight(handle: HandlePosition): boolean {
  return handle.includes('e')
}

function movesTop(handle: HandlePosition): boolean {
  return handle === 'nw' || handle === 'n' || handle === 'ne'
}

function movesBottom(handle: HandlePosition): boolean {
  return handle === 'sw' || handle === 's' || handle === 'se'
}

function resizeTargets(drag: DragResize, editor: Editor): SceneNode[] {
  const node = editor.graph.getNode(drag.nodeId)
  const parentId = node?.parentId ?? editor.state.currentPageId
  return editor.graph
    .getChildren(parentId)
    .filter((candidate) => candidate.id !== drag.nodeId && candidate.visible)
    .map((candidate) => worldBoundsNode(candidate, editor))
}

function activeEdgeBounds(handle: HandlePosition, rect: Rect): Rect {
  const horizontal = movesLeft(handle) || movesRight(handle)
  const vertical = movesTop(handle) || movesBottom(handle)
  let x = rect.x
  let y = rect.y
  if (movesRight(handle)) x += rect.width
  if (movesBottom(handle)) y += rect.height
  return {
    x,
    y,
    width: horizontal ? 0 : rect.width,
    height: vertical ? 0 : rect.height
  }
}

function applyEdgeDelta(handle: HandlePosition, rect: Rect, dx: number, dy: number): Rect {
  let { x, y, width, height } = rect
  if (movesLeft(handle)) {
    x += dx
    width -= dx
  } else if (movesRight(handle)) {
    width += dx
  }
  if (movesTop(handle)) {
    y += dy
    height -= dy
  } else if (movesBottom(handle)) {
    height += dy
  }
  return { x, y, width: Math.max(1, width), height: Math.max(1, height) }
}

function hasAxisAlignedWorldBasis(node: SceneNode, editor: Editor): boolean {
  const matrix = getWorldMatrix(node, editor.graph)
  return Math.abs(matrix[1]) <= 1e-6 && Math.abs(matrix[3]) <= 1e-6
}

export function applyResizeSnap(
  drag: DragResize,
  rect: Rect,
  editor: Editor,
  disableSnapping: boolean
): Rect {
  const state = optionalEditorState(editor)
  if (disableSnapping || !state) {
    if (state) state.snapGuides = []
    return rect
  }

  const node = editor.graph.getNode(drag.nodeId)
  if (!node) return rect
  // The current candidate model is axis-aligned. Do not apply a world-axis
  // correction as a local width/height delta for rotated nodes or ancestors.
  if (!hasAxisAlignedWorldBasis(node, editor)) {
    editor.state.snapGuides = []
    return rect
  }
  const candidate = { ...node, ...rect }
  const worldBounds = getAxisAlignedWorldBounds(candidate, editor.graph)
  const activeBounds = activeEdgeBounds(drag.handle, worldBounds)
  const snap = resolveObjectPixelSnap(
    new Set([drag.nodeId]),
    activeBounds,
    resizeTargets(drag, editor),
    editor,
    explicitSnapTargets(node.parentId, editor)
  )
  const horizontal = movesLeft(drag.handle) || movesRight(drag.handle)
  const vertical = movesTop(drag.handle) || movesBottom(drag.handle)
  const localCorrection = worldDeltaToParentLocal(snap.correction, node.parentId, editor)
  const dx = horizontal ? localCorrection.x : 0
  const dy = vertical ? localCorrection.y : 0

  state.snapGuides = snap.guides
  return applyEdgeDelta(drag.handle, rect, dx, dy)
}
