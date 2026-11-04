import { compact } from 'es-toolkit'
import { toRaw } from 'vue'

import type { Editor } from '@open-pencil/core'
import {
  storedSelectionAngle,
  transformZoneAt,
  type HandlePosition
} from '@open-pencil/core/geometry'
import {
  placeInResizedBounds,
  selectionFrame,
  selectionPlacement,
  turnPoint,
  type SelectionFrame
} from '@open-pencil/scene-graph/coordinate'

import { pointInFrame } from '#vue/shared/input/geometry'
import {
  applyResizedRect,
  cancelResizePreview,
  commitResizePreview,
  scaledChanges
} from '#vue/shared/input/resize'
import { calculateResizeRect } from '#vue/shared/input/resize/rect'
import { createResizeDrag } from '#vue/shared/input/resize/start'
import type { DragResizeSelection, DragState } from '#vue/shared/input/types'

/**
 * A multi-selection's box in its frame, the box the overlay draws its handles on: turned to the
 * angle a rotation left it at or its layers share, or while it turns, its turning frame. Null for
 * fewer than two layers.
 */
export function selectionBox(editor: Editor): SelectionFrame | null {
  if (editor.state.selectedIds.size < 2) return null
  const nodes = compact([...editor.state.selectedIds].map((id) => editor.graph.getNode(id)))
  if (nodes.length < 2) return null
  return (
    editor.state.selectionRotationPreview ??
    selectionFrame(
      nodes,
      editor.graph,
      storedSelectionAngle(editor.state.selectedIds, editor.state.selectionAngle)
    )
  )
}

/** The multi-selection box's resize handle under a canvas point, with the box's angle. */
export function selectionResizeHandleAt(
  cx: number,
  cy: number,
  editor: Editor
): { handle: HandlePosition; angle: number } | null {
  const frame = selectionBox(editor)
  if (!frame) return null
  const zone = transformZoneAt(pointInFrame(cx, cy, frame), frame.box, editor.renderer?.zoom ?? 1)
  return zone?.kind === 'resize' ? { handle: zone.handle, angle: frame.angle } : null
}

/** Starts resizing a multi-selection from a handle of its box; unlocked layers take part. */
export function tryStartSelectionResize(
  cx: number,
  cy: number,
  editor: Editor
): DragResizeSelection | null {
  const frame = selectionBox(editor)
  const hit = selectionResizeHandleAt(cx, cy, editor)
  if (!frame || !hit) return null
  const members = compact(
    [...editor.state.selectedIds].map((id) => {
      const node = editor.graph.getNode(id)
      if (!node || node.locked) return undefined
      return {
        drag: createResizeDrag(node, hit.handle, cx, cy, editor),
        placement: selectionPlacement(node, editor.graph)
      }
    })
  )
  if (members.length === 0) return null
  return {
    type: 'resize-selection',
    handle: hit.handle,
    startX: cx,
    startY: cy,
    origBounds: frame.box,
    angle: frame.angle,
    members
  }
}

/** Scales the selection's box along its frame with the pointer; Shift keeps its proportions. */
export function applySelectionResize(
  dragState: DragResizeSelection,
  cx: number,
  cy: number,
  shiftKey: boolean,
  editor: Editor
) {
  // As in applyResize: reactive drag state must not leak into graph writes.
  const d = toRaw(dragState)
  const { origBounds } = d
  const aspect =
    shiftKey && origBounds.width > 0 && origBounds.height > 0
      ? origBounds.width / origBounds.height
      : null
  const delta = turnPoint({ x: cx - d.startX, y: cy - d.startY }, -d.angle)
  const bounds = calculateResizeRect(d.handle, origBounds, delta.x, delta.y, aspect)
  for (const { drag, placement } of d.members) {
    const node = editor.graph.getNode(drag.nodeId)
    if (!node) continue
    const rect = placeInResizedBounds(placement, origBounds, bounds, d.angle)
    applyResizedRect(drag, node, rect, scaledChanges(drag, node.type, rect), editor)
  }
  editor.requestRepaint()
}

/** Commits every member's resize, then fits the groups around them once, as one undo step. */
export function commitSelectionResize(dragState: DragResizeSelection, editor: Editor) {
  const d = toRaw(dragState)
  editor.undo.runBatch('Resize', () => {
    for (const { drag } of d.members) commitResizePreview(drag, editor, { fitGroups: false })
    const parentIds = compact(
      d.members.map(({ drag }) => editor.graph.getNode(drag.nodeId)?.parentId)
    )
    editor.fitEnclosingGroups(new Set(parentIds))
  })
}

/** Puts every member back where the abandoned resize started. */
export function cancelSelectionResize(dragState: DragResizeSelection, editor: Editor) {
  for (const { drag } of toRaw(dragState).members) cancelResizePreview(drag, editor)
}

/** Puts back a single-layer or multi-selection resize the pointer abandoned; other drags pass. */
export function cancelResizeDrag(dragState: DragState | null, editor: Editor) {
  if (dragState?.type === 'resize') cancelResizePreview(dragState, editor)
  else if (dragState?.type === 'resize-selection') cancelSelectionResize(dragState, editor)
}
