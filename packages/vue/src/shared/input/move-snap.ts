import type { Editor } from '@open-pencil/core/editor'
import { computeSelectionBounds } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'

import { explicitSnapTargets } from '#vue/shared/input/explicit-snap-targets'
import {
  resolveObjectPixelSnap,
  worldBoundsNode,
  worldDeltaToParentLocal
} from '#vue/shared/input/snap'
import type { DragMove } from '#vue/shared/input/types'

function movingSelection(drag: DragMove, dx: number, dy: number, editor: Editor): SceneNode[] {
  const selectedNodes: SceneNode[] = []
  for (const [id, original] of drag.originals) {
    const node = editor.graph.getNode(id)
    if (!node) continue
    const bounds = getAxisAlignedWorldBounds(
      { ...node, x: original.x, y: original.y },
      editor.graph
    )
    selectedNodes.push({
      ...node,
      x: bounds.x + dx,
      y: bounds.y + dy,
      width: bounds.width,
      height: bounds.height,
      rotation: 0,
      flipX: false,
      flipY: false
    })
  }
  return selectedNodes
}

function moveParentId(drag: DragMove, editor: Editor): string {
  const firstId = drag.originals.keys().next().value
  const firstNode = firstId ? editor.graph.getNode(firstId) : undefined
  return firstNode?.parentId ?? editor.state.currentPageId
}

function parentTargets(parentId: string, editor: Editor): SceneNode[] {
  return editor.graph
    .getChildren(parentId)
    .filter((node) => node.visible)
    .map((node) => worldBoundsNode(node, editor))
}

export function applyMoveSnap(
  drag: DragMove,
  dx: number,
  dy: number,
  editor: Editor,
  disableSnapping = false
): { dx: number; dy: number } {
  const parentId = moveParentId(drag, editor)
  const localDelta = worldDeltaToParentLocal({ x: dx, y: dy }, parentId, editor)
  const selectionBounds = computeSelectionBounds(movingSelection(drag, dx, dy, editor))
  if (!selectionBounds || disableSnapping) {
    editor.setSnapGuides([])
    return { dx: localDelta.x, dy: localDelta.y }
  }

  const snap = resolveObjectPixelSnap(
    editor.state.selectedIds,
    selectionBounds,
    parentTargets(parentId, editor),
    editor,
    explicitSnapTargets(parentId, editor)
  )
  editor.setSnapGuides(snap.guides)
  const localCorrection = worldDeltaToParentLocal(snap.correction, parentId, editor)
  return {
    dx: localDelta.x + localCorrection.x,
    dy: localDelta.y + localCorrection.y
  }
}
