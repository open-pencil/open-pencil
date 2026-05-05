import type { Editor } from '@open-pencil/core/editor'
import { computeSelectionBounds, computeSnap } from '@open-pencil/core/scene-graph'
import type { SceneNode } from '@open-pencil/core/scene-graph'

import type { DragMove } from '#vue/shared/input/types'

export function applyMoveSnap(
  d: DragMove,
  dx: number,
  dy: number,
  editor: Editor
): { dx: number; dy: number } {
  const selectedNodes: SceneNode[] = []
  for (const [id, orig] of d.originals) {
    const node = editor.graph.getNode(id)
    if (node) {
      const abs = editor.graph.getAbsolutePosition(id)
      const parentAbs = node.parentId
        ? editor.graph.getAbsolutePosition(node.parentId)
        : { x: 0, y: 0 }
      selectedNodes.push({
        ...node,
        x: abs.x - parentAbs.x - node.x + orig.x + dx,
        y: abs.y - parentAbs.y - node.y + orig.y + dy
      })
    }
  }

  const bounds = computeSelectionBounds(selectedNodes)
  if (!bounds) return { dx, dy }

  const firstId = [...d.originals.keys()][0]
  const firstNode = editor.graph.getNode(firstId)
  const parentId = firstNode?.parentId ?? editor.state.currentPageId
  const siblings = editor.graph.getChildren(parentId)
  const parentAbs = !editor.isTopLevel(parentId)
    ? editor.graph.getAbsolutePosition(parentId)
    : { x: 0, y: 0 }
  const absTargets = siblings.map((node) => ({
    ...node,
    x: node.x + parentAbs.x,
    y: node.y + parentAbs.y
  }))
  const absBounds = {
    x: bounds.x + parentAbs.x,
    y: bounds.y + parentAbs.y,
    width: bounds.width,
    height: bounds.height
  }
  const snap = computeSnap(editor.state.selectedIds, absBounds, absTargets)
  editor.setSnapGuides(snap.guides)
  return { dx: dx + snap.dx, dy: dy + snap.dy }
}
