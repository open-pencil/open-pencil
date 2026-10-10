import type { SceneNode } from '@open-pencil/scene-graph'

import {
  autoLayoutInsertIndex,
  computeAutoLayoutIndicator,
  computeIndicatorPosition,
  computeAutoLayoutIndicatorForFrame
} from '#vue/shared/input/auto-layout'
import {
  isPastPointerDragThreshold,
  POINTER_DRAG_START_THRESHOLD_PX
} from '#vue/shared/input/drag-threshold'
import { findMoveDropTarget, reparentDroppedNodes } from '#vue/shared/input/drop-target'
export { duplicateAndDrag } from '#vue/shared/input/duplicate-drag'
import type { Editor } from '@open-pencil/core/editor'

import { flowBlockBounds, flowOrder, flowSlot, type FlowDrag } from '#vue/shared/input/flow-reorder'
import { applyMoveSnap } from '#vue/shared/input/move-snap'
import type { DragMove } from '#vue/shared/input/types'

const AUTO_LAYOUT_REORDER_CLICK_SLOP = 3
/**
 * How far past its auto layout frame's edge a dragged layer's near edge goes before the layer
 * leaves the frame, in canvas units, as measured in Figma desktop 126: 5 across the flow, and
 * 13 to 20 along it depending on the layer's size.
 */
const AUTO_LAYOUT_LEAVE_MARGIN_ACROSS = 5
const AUTO_LAYOUT_LEAVE_MARGIN_ALONG = 15
export const MOVE_DRAG_START_THRESHOLD_PX = POINTER_DRAG_START_THRESHOLD_PX

/** Whether layers whose box in the frame's own space is `bounds` stay close enough to its flow. */
function staysInAutoLayout(
  parentId: string,
  bounds: { left: number; top: number; right: number; bottom: number },
  editor: Editor
) {
  const parent = editor.graph.getNode(parentId)
  if (!parent) return false
  // How far the layers' near edge is past the frame's edge on each of the frame's own axes, with
  // `bounds` in the frame's space; negative while they overlap.
  const pastX = Math.max(-bounds.right, bounds.left - parent.width)
  const pastY = Math.max(-bounds.bottom, bounds.top - parent.height)
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const along = isRow ? pastX : pastY
  const across = isRow ? pastY : pastX
  return along <= AUTO_LAYOUT_LEAVE_MARGIN_ALONG && across <= AUTO_LAYOUT_LEAVE_MARGIN_ACROSS
}

/**
 * Keeps dragged layers in their flows while they stay close, as Figma does: each flow's block
 * takes the slot the drag has reached, which the indicator shows for the first flow that moved.
 * Returns false once a flow's layers leave it, and the move goes on as a free drag.
 */
function dragAlongFlows(d: DragMove, flows: FlowDrag[], dx: number, dy: number, editor: Editor) {
  if (d.ignoreAutoLayout) return false
  if (
    !flows.every((flow) =>
      staysInAutoLayout(flow.parentId, flowBlockBounds(flow, dx, dy, editor), editor)
    )
  )
    return false
  d.flowSlots = flows.map((flow) => flowSlot(flow, dx, dy, editor))
  const moved = flows.findIndex((flow, i) => d.flowSlots?.[i] !== flow.start)
  const flow = moved === -1 ? undefined : flows[moved]
  const parent = flow && editor.graph.getNode(flow.parentId)
  if (!flow || !parent) {
    editor.setLayoutInsertIndicator(null)
    return true
  }
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const others = flow.others.flatMap((id) => editor.graph.getNode(id) ?? [])
  const parentAbs = editor.graph.getAbsolutePosition(parent.id)
  const position = computeIndicatorPosition(
    others,
    d.flowSlots[moved],
    parent,
    parentAbs,
    isRow,
    editor
  )
  editor.setLayoutInsertIndicator({
    parentId: parent.id,
    index: d.flowSlots[moved],
    x: isRow ? position : parentAbs.x + parent.paddingLeft,
    y: isRow ? parentAbs.y + parent.paddingTop : position,
    length: isRow
      ? parent.height - parent.paddingTop - parent.paddingBottom
      : parent.width - parent.paddingLeft - parent.paddingRight,
    direction: isRow ? 'VERTICAL' : 'HORIZONTAL'
  })
  return true
}

/** Puts each flow's block in the slot the drag reached, as one undo step. */
function dropAlongFlows(d: DragMove, flows: FlowDrag[], editor: Editor) {
  editor.undo.runBatch('Reorder', () => {
    for (const [i, flow] of flows.entries()) {
      const slot = d.flowSlots?.[i] ?? flow.start
      if (slot === flow.start) continue
      editor.setChildOrder(flow.parentId, flowOrder(flow, slot, editor))
    }
  })
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

/** Keys held during a move. Figma maps Control to both, Shift to an axis lock. */
export interface MoveModifiers {
  /** Turns off snapping and drops into auto layout as an absolute-positioned layer. */
  ctrlKey?: boolean
  /** Locks the move to the axis it has travelled furthest along. */
  shiftKey?: boolean
}

function lockToAxis(dx: number, dy: number, lock: boolean) {
  if (!lock) return { dx, dy }
  return Math.abs(dx) >= Math.abs(dy) ? { dx, dy: 0 } : { dx: 0, dy }
}

/**
 * Where Control drops layers among an auto layout frame's children. Like Figma, layers from
 * elsewhere go in at the cursor; layers already in the frame go on top.
 */
function absoluteInsertIndex(
  d: DragMove,
  target: SceneNode | null,
  cx: number,
  cy: number,
  editor: Editor,
  moving: ReadonlySet<string>
) {
  if (!d.ignoreAutoLayout || !target || target.layoutMode === 'NONE') return undefined
  // The graph clamps an index past the end, which puts the layers on top.
  if ([...d.originals.values()].some((orig) => orig.parentId === target.id))
    return target.childIds.length
  return autoLayoutInsertIndex(target, cx, cy, editor, moving)
}

function isPastDragStartThreshold(d: DragMove, sx: number, sy: number) {
  return isPastPointerDragThreshold(d.startScreenX, d.startScreenY, sx, sy)
}

/**
 * Keeps a move in the auto layout the layers started in while they stay close to it; returns
 * whether it did. Once they leave, the move goes on as a free drag.
 */
function keepsOwnAutoLayout(
  d: DragMove,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  editor: Editor
): boolean {
  if (d.flows) {
    if (dragAlongFlows(d, d.flows, dx, dy, editor)) return true
    d.flowSlots = undefined
  } else if (d.autoLayoutParentId && !d.ignoreAutoLayout) {
    // A wrapped flow, which still reorders by the cursor.
    const [id] = d.originals.keys()
    const block = { parentId: d.autoLayoutParentId, ids: id ? [id] : [], others: [], start: 0 }
    if (staysInAutoLayout(d.autoLayoutParentId, flowBlockBounds(block, dx, dy, editor), editor)) {
      computeAutoLayoutIndicator(d, cx, cy, editor)
      return true
    }
  } else if (!d.autoLayoutParentId) {
    return false
  }
  d.brokeFromAutoLayout = true
  editor.setLayoutInsertIndicator(null)
  return false
}

export function handleMoveMove(
  d: DragMove,
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  editor: Editor,
  modifiers: MoveModifiers = {}
) {
  d.currentX = cx
  d.currentY = cy
  d.ignoreAutoLayout = modifiers.ctrlKey === true

  if (!d.dragStarted) {
    if (!isPastDragStartThreshold(d, sx, sy)) return
    d.dragStarted = true
  }

  let { dx, dy } = lockToAxis(cx - d.startX, cy - d.startY, modifiers.shiftKey === true)

  if (!d.brokeFromAutoLayout && keepsOwnAutoLayout(d, dx, dy, cx, cy, editor)) return

  const moving = new Set(d.originals.keys())
  const dropTarget = d.keepParents ? null : findMoveDropTarget(cx, cy, editor, moving)
  d.absoluteInsertIndex = absoluteInsertIndex(d, dropTarget, cx, cy, editor, moving)

  if (dropTarget && dropTarget.layoutMode !== 'NONE' && !d.ignoreAutoLayout) {
    computeAutoLayoutIndicatorForFrame(dropTarget, cx, cy, editor)
    editor.setDropTarget(dropTarget.id)
    let firstApplied: { dx: number; dy: number } | null = null
    for (const [id, orig] of d.originals) {
      const previewX = Math.round(orig.x + dx)
      const previewY = Math.round(orig.y + dy)
      firstApplied ??= { dx: previewX - orig.x, dy: previewY - orig.y }
      editor.graph.updateNodePositionPreview(id, previewX, previewY)
    }
    if (firstApplied) {
      d.appliedDx = firstApplied.dx
      d.appliedDy = firstApplied.dy
    }
    editor.requestRepaint()
    return
  }

  editor.setLayoutInsertIndicator(null)

  const snapped = applyMoveSnap(d, dx, dy, editor, modifiers.ctrlKey === true)
  // Snapping must not pull the layer off a locked axis.
  ;({ dx, dy } = lockToAxis(snapped.dx, snapped.dy, modifiers.shiftKey === true))
  d.appliedDx = dx
  d.appliedDy = dy

  for (const [id, orig] of d.originals) {
    editor.graph.updateNodePositionPreview(id, orig.x + dx, orig.y + dy)
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

function isLeavingAutoLayout(d: DragMove, id: string, editor: Editor) {
  const node = editor.graph.getNode(id)
  const parent = editor.graph.getNode(node?.parentId ?? '')
  if (d.keepParents || !parent || parent.layoutMode === 'NONE') return false
  if (node?.layoutPositioning === 'ABSOLUTE') return false
  return (editor.state.dropTargetId ?? editor.state.currentPageId) !== parent.id
}

function applyFinalPositions(d: DragMove, editor: Editor) {
  for (const [id, orig] of d.originals) {
    const position = { x: orig.x + d.appliedDx, y: orig.y + d.appliedDy }
    // Laying out now would snap the layer back into its slot before it leaves the frame.
    if (isLeavingAutoLayout(d, id, editor)) editor.graph.updateNode(id, position)
    else editor.updateNode(id, position)
  }
}

/** Closes the gaps moved layers leave in auto layout frames. */
function layOutOriginalParents(d: DragMove, editor: Editor) {
  for (const parentId of new Set([...d.originals.values()].map((orig) => orig.parentId))) {
    if (editor.graph.getNode(parentId)?.layoutMode !== 'NONE') editor.runLayoutForNode(parentId)
  }
}

/** Control into auto layout: absolute first, so layout keeps the positions the move writes. */
function ignoreTargetAutoLayout(d: DragMove, editor: Editor) {
  const targetId = editor.state.dropTargetId
  const target = targetId ? editor.graph.getNode(targetId) : null
  if (d.keepParents || !d.ignoreAutoLayout || !target || target.layoutMode === 'NONE') return
  for (const id of d.originals.keys()) {
    if (editor.graph.getNode(id)?.layoutPositioning === 'ABSOLUTE') continue
    editor.updateNodeWithUndo(id, { layoutPositioning: 'ABSOLUTE' }, 'Ignore auto layout')
  }
}

function dropMovedNodes(d: DragMove, editor: Editor) {
  const ids = [...d.originals.keys()]
  reparentDroppedNodes(editor, ids, editor.state.dropTargetId)
  for (const id of ids) {
    if (editor.graph.getNode(id)?.type === 'SECTION') editor.adoptCoveredLayers(id)
  }
}

function movedParentIds(d: DragMove, editor: Editor) {
  const ids = new Set<string>()
  for (const [id, orig] of d.originals) {
    ids.add(orig.parentId)
    const parentId = editor.graph.getNode(id)?.parentId
    if (parentId) ids.add(parentId)
  }
  return ids
}

function placeAbsoluteDrop(d: DragMove, editor: Editor) {
  const targetId = editor.state.dropTargetId
  const index = d.absoluteInsertIndex
  if (!targetId || index === undefined) return
  const ids = [...d.originals.keys()].filter(
    (id) => editor.graph.getNode(id)?.parentId === targetId
  )
  for (const [offset, id] of ids.entries())
    editor.reorderChildWithUndo(id, targetId, index + offset)
}

export function handleMoveUp(d: DragMove, editor: Editor) {
  if (!d.dragStarted) {
    editor.setLayoutInsertIndicator(null)
    editor.setSnapGuides([])
    editor.setDropTarget(null)
    if (d.selectOnClick) editor.select([d.selectOnClick])
    return
  }

  const indicator = editor.state.layoutInsertIndicator
  editor.setLayoutInsertIndicator(null)
  editor.setSnapGuides([])

  // Slots exist only once the drag started, so a reached slot is a reorder however short the drag.
  if (d.flows && d.flowSlots && !d.brokeFromAutoLayout) {
    dropAlongFlows(d, d.flows, editor)
    editor.setDropTarget(null)
    return
  }

  if (indicator) {
    if (getMoveDistance(d) < AUTO_LAYOUT_REORDER_CLICK_SLOP) {
      editor.setDropTarget(null)
      return
    }
    // Claiming a slot records its own step; the batch makes it one undo with the reorder.
    editor.undo.runBatch('Reorder', () => {
      for (const id of d.originals.keys()) {
        editor.reorderInAutoLayout(id, indicator.parentId, indicator.index)
      }
    })
    editor.setDropTarget(null)
    return
  }

  const moved = hasMoved(d, editor)

  if (d.duplicated && !moved) {
    const previousSelection = d.duplicatedPreviousSelection ?? new Set<string>()
    for (const id of [...d.originals.keys()].toReversed()) editor.graph.deleteNode(id)
    editor.select([...previousSelection])
    editor.requestRender()
    editor.setDropTarget(null)
    return
  }

  // The batch keeps a slot claim in the same undo step; it carries the edit's own name.
  editor.undo.runBatch(d.duplicated ? 'Duplicate' : 'Move', () => {
    if (moved) {
      ignoreTargetAutoLayout(d, editor)
      restoreOriginalPositions(d, editor)
      applyFinalPositions(d, editor)
      if (!d.keepParents) dropMovedNodes(d, editor)
      layOutOriginalParents(d, editor)
    }
    if (d.duplicated) {
      editor.commitDuplicateMove(
        [...d.originals.keys()],
        d.duplicatedPreviousSelection ?? new Set<string>()
      )
    } else if (moved) {
      editor.commitMoveWithReparent(d.originals)
    }
    // After the move is recorded, so undo restores the order before taking the layers back out.
    if (moved && !d.keepParents) placeAbsoluteDrop(d, editor)
    // Groups and booleans the layers left or moved inside fit their children again.
    if (moved) editor.fitEnclosingGroups(movedParentIds(d, editor))
  })
  editor.setDropTarget(null)
}
