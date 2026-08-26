import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import { explicitSnapTargets } from '#vue/shared/input/explicit-snap-targets'
import {
  resolveObjectPixelSnap,
  type GeometrySnapTarget,
  worldBoundsNode
} from '#vue/shared/input/snap'
import type { DragEditNode } from '#vue/shared/input/types'
import type { NodeEditState } from '#vue/shared/input/vector/hit-test'

function draggedVertexBounds(drag: DragEditNode, dx: number, dy: number): Rect | null {
  if (drag.origPositions.size === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const position of drag.origPositions.values()) {
    const x = position.x + dx
    const y = position.y + dy
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function siblingSnapTargets(editor: Editor, editedNode: SceneNode): SceneNode[] {
  const parentId = editedNode.parentId ?? editor.state.currentPageId
  return editor.graph
    .getChildren(parentId)
    .filter((node) => node.id !== editedNode.id && node.visible)
    .map((node) => worldBoundsNode(node, editor))
}

function geometrySnapTargets(
  editor: Editor,
  editState: NodeEditState,
  movingIndices: Set<number>
): GeometrySnapTarget[] {
  if (!editor.state.snappingPreferences.geometry) return []
  return editState.vertices.flatMap((vertex, index) => {
    if (movingIndices.has(index)) return []
    return [
      {
        kind: 'geometry',
        axis: 'x',
        position: vertex.x,
        from: vertex.y,
        to: vertex.y
      },
      {
        kind: 'geometry',
        axis: 'y',
        position: vertex.y,
        from: vertex.x,
        to: vertex.x
      }
    ]
  })
}

export function applyNodeEditSnap(
  drag: DragEditNode,
  dx: number,
  dy: number,
  editor: Editor,
  editState: NodeEditState
): Vector {
  const bounds = draggedVertexBounds(drag, dx, dy)
  const editedNode = editor.graph.getNode(editState.nodeId)
  if (!bounds || !editedNode) {
    editor.setSnapGuides([])
    return { x: dx, y: dy }
  }

  const parentId = editedNode.parentId ?? editor.state.currentPageId
  const snap = resolveObjectPixelSnap(
    new Set([editedNode.id]),
    bounds,
    siblingSnapTargets(editor, editedNode),
    editor,
    explicitSnapTargets(parentId, editor),
    geometrySnapTargets(editor, editState, new Set(drag.origPositions.keys()))
  )
  editor.setSnapGuides(snap.guides)
  return { x: dx + snap.correction.x, y: dy + snap.correction.y }
}
