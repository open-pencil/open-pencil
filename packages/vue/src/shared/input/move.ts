import {
  computeAutoLayoutIndicator,
  computeAutoLayoutIndicatorForFrame
} from '#vue/shared/input/auto-layout'
import { findMoveDropTarget, reparentOutsideNodes } from '#vue/shared/input/drop-target'
export { duplicateAndDrag } from '#vue/shared/input/duplicate-drag'
import { AUTO_LAYOUT_BREAK_THRESHOLD } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'

import { applyMoveSnap } from '#vue/shared/input/move-snap'
import type { DragMove } from '#vue/shared/input/types'

const AUTO_LAYOUT_REORDER_CLICK_SLOP = 3
const AUTO_LAYOUT_CROSS_AXIS_DRAG_TOLERANCE = 96

function isInsideAutoLayoutDragBounds(parentId: string, cx: number, cy: number, editor: Editor) {
  const parent = editor.graph.getNode(parentId)
  if (!parent) return false
  const abs = editor.graph.getAbsolutePosition(parentId)
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const mainStart = isRow ? abs.x : abs.y
  const mainSize = isRow ? parent.width : parent.height
  const crossStart = isRow ? abs.y : abs.x
  const crossSize = isRow ? parent.height : parent.width
  const main = isRow ? cx : cy
  const cross = isRow ? cy : cx
  return (
    main >= mainStart - AUTO_LAYOUT_BREAK_THRESHOLD &&
    main <= mainStart + mainSize + AUTO_LAYOUT_BREAK_THRESHOLD &&
    cross >= crossStart - AUTO_LAYOUT_CROSS_AXIS_DRAG_TOLERANCE &&
    cross <= crossStart + crossSize + AUTO_LAYOUT_CROSS_AXIS_DRAG_TOLERANCE
  )
}

export function detectAutoLayoutParent(editor: Editor): string | undefined {
  if (editor.state.selectedIds.size !== 1) return undefined
  const selectedId = [...editor.state.selectedIds][0]
  const selectedNode = editor.graph.getNode(selectedId)
  if (!selectedNode?.parentId) return undefined
  const parent = editor.graph.getNode(selectedNode.parentId)
  if (parent && parent.layoutMode !== 'NONE' && selectedNode.layoutPositioning !== 'ABSOLUTE') {
    return parent.id
  }
  return undefined
}

export function handleMoveMove(d: DragMove, cx: number, cy: number, editor: Editor) {
  d.currentX = cx
  d.currentY = cy

  let dx = cx - d.startX
  let dy = cy - d.startY

  if (d.autoLayoutParentId && !d.brokeFromAutoLayout) {
    if (isInsideAutoLayoutDragBounds(d.autoLayoutParentId, cx, cy, editor)) {
      computeAutoLayoutIndicator(d, cx, cy, editor)
      return
    }
    d.brokeFromAutoLayout = true
    editor.setLayoutInsertIndicator(null)
  }

  const dropTarget = findMoveDropTarget(cx, cy, editor)
  const dropParent = dropTarget ? editor.graph.getNode(dropTarget.id) : null

  if (dropParent && dropParent.layoutMode !== 'NONE') {
    computeAutoLayoutIndicatorForFrame(dropParent, cx, cy, editor)
    editor.setDropTarget(dropParent.id)
    for (const [id, orig] of d.originals) {
      editor.graph.updateNodePositionPreview(id, Math.round(orig.x + dx), Math.round(orig.y + dy))
    }
    editor.requestRepaint()
    return
  }

  editor.setLayoutInsertIndicator(null)

  const snapped = applyMoveSnap(d, dx, dy, editor)
  dx = snapped.dx
  dy = snapped.dy

  for (const [id, orig] of d.originals) {
    editor.graph.updateNodePositionPreview(id, Math.round(orig.x + dx), Math.round(orig.y + dy))
  }

  editor.setDropTarget(dropTarget?.id ?? null)
  editor.requestRepaint()
}

function getMoveDistance(d: DragMove) {
  return Math.hypot(d.currentX - d.startX, d.currentY - d.startY)
}

function hasMoved(d: DragMove, editor: Editor) {
  return [...d.originals].some(([id, orig]) => {
    const node = editor.graph.getNode(id)
    return node && (node.x !== orig.x || node.y !== orig.y)
  })
}

function restoreOriginalPositions(d: DragMove, editor: Editor) {
  for (const [id, orig] of d.originals) {
    editor.graph.updateNodePositionPreview(id, orig.x, orig.y)
  }
}

function applyFinalPositions(d: DragMove, editor: Editor) {
  const dx = d.currentX - d.startX
  const dy = d.currentY - d.startY
  for (const [id, orig] of d.originals) {
    editor.updateNode(id, { x: Math.round(orig.x + dx), y: Math.round(orig.y + dy) })
  }
}

export function handleMoveUp(d: DragMove, editor: Editor) {
  const indicator = editor.state.layoutInsertIndicator
  editor.setLayoutInsertIndicator(null)
  editor.setSnapGuides([])

  if (indicator) {
    if (getMoveDistance(d) < AUTO_LAYOUT_REORDER_CLICK_SLOP) {
      editor.setDropTarget(null)
      return
    }
    for (const id of d.originals.keys()) {
      editor.reorderInAutoLayout(id, indicator.parentId, indicator.index)
    }
    editor.setDropTarget(null)
    return
  }

  const moved = hasMoved(d, editor)

  if (moved) {
    restoreOriginalPositions(d, editor)
    applyFinalPositions(d, editor)
    const dropId = editor.state.dropTargetId
    if (dropId) {
      editor.reparentNodes([...editor.state.selectedIds], dropId)
    } else {
      reparentOutsideNodes(editor)
    }
  }

  if (d.duplicated) {
    editor.commitDuplicateMove([...d.originals.keys()], d.duplicatedPreviousSelection ?? new Set())
  } else if (moved) {
    editor.commitMoveWithReparent(d.originals)
  }
  editor.setDropTarget(null)
}
