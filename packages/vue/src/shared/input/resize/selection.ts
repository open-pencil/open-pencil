import { compact } from 'es-toolkit'
import { toRaw } from 'vue'

import { resolveEditorProfile, type Editor } from '@open-pencil/core'
import {
  createSceneGeometry,
  transformZoneAt,
  type HandlePosition
} from '@open-pencil/core/geometry'
import type { SceneNode } from '@open-pencil/scene-graph'
import { placeInResizedBounds, selectionPlacement } from '@open-pencil/scene-graph/coordinate'
import { layerResizes } from '@open-pencil/scene-graph/generated'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import {
  applyResizedRect,
  cancelResizePreview,
  commitResizePreview,
  scaledChanges
} from '#vue/shared/input/resize'
import { signedResizeRect } from '#vue/shared/input/resize/rect'
import { applyBoxResizeSnap, proportionalBoxResizeRect } from '#vue/shared/input/resize/snap'
import { createResizeDrag } from '#vue/shared/input/resize/start'
import { optionalEditorState } from '#vue/shared/input/snap'
import type { DragResizeSelection, DragState } from '#vue/shared/input/types'

/**
 * A multi-selection's box on the canvas, the box the overlay draws its handles on: its layers'
 * axis-aligned bounds, as Figma draws a multi-selection whatever its layers' angles. Null for
 * fewer than two layers.
 */
export function selectionBox(editor: Editor): Rect | null {
  if (editor.state.selectedIds.size < 2) return null
  const nodes = compact([...editor.state.selectedIds].map((id) => editor.graph.getNode(id)))
  if (nodes.length < 2) return null
  const geometry = createSceneGeometry(editor.graph)
  return computeBounds(nodes.map((node) => geometry.bounds(node)))
}

/**
 * Whether a multi-selection's handles act on any of its layers: an unlocked one that `takes` the
 * action. A press starts nothing otherwise, so hovering shows no cursor for it either.
 */
export function selectionTakes(editor: Editor, takes: (node: SceneNode) => boolean): boolean {
  return [...editor.state.selectedIds].some((id) => {
    const node = editor.graph.getNode(id)
    return node !== undefined && !node.locked && takes(node)
  })
}

/** The multi-selection box's resize handle under a canvas point. */
export function selectionResizeHandleAt(
  cx: number,
  cy: number,
  editor: Editor
): HandlePosition | null {
  const box = selectionBox(editor)
  if (!box || !selectionTakes(editor, layerResizes)) return null
  const zone = transformZoneAt({ x: cx, y: cy }, box, editor.renderer?.zoom ?? 1)
  return zone?.kind === 'resize' ? zone.handle : null
}

/** Starts resizing a multi-selection from a handle of its box; unlocked layers take part. */
export function tryStartSelectionResize(
  cx: number,
  cy: number,
  editor: Editor
): DragResizeSelection | null {
  const box = selectionBox(editor)
  const handle = selectionResizeHandleAt(cx, cy, editor)
  if (!box || !handle) return null
  const members = compact(
    [...editor.state.selectedIds].map((id) => {
      const node = editor.graph.getNode(id)
      // A sticky note only scales, from its own corners, and a connector follows its ends.
      if (!node || node.locked || !layerResizes(node)) return undefined
      const drag = createResizeDrag(node, handle, cx, cy, editor)
      return { drag, placement: drag.origPlacement ?? selectionPlacement(node, editor.graph) }
    })
  )
  if (members.length === 0) return null
  return {
    type: 'resize-selection',
    handle,
    parentId: members[0].placement.node.parentId ?? editor.state.currentPageId,
    startX: cx,
    startY: cy,
    origBounds: box,
    members
  }
}

function roundsToPixels(editor: Editor): boolean {
  const state = optionalEditorState(editor)
  return (
    state !== undefined &&
    state.snappingPreferences.pixelGrid &&
    resolveEditorProfile(state).pixelGrid
  )
}

/** `size` at least a pixel long, keeping its sign. */
function atLeastOne(size: number): number {
  return Math.sign(size || 1) * Math.max(Math.abs(size), 1)
}

/**
 * The box a handle drag gives the selection, with signed sizes: dragged past the opposite edge,
 * the box and every layer in it come out mirrored. Its moving edges snap as a layer's do unless
 * Control turns snapping off; a mirrored box lands where the pointer puts it.
 */
function resizedBox(
  d: DragResizeSelection,
  cx: number,
  cy: number,
  shiftKey: boolean,
  ctrlKey: boolean,
  editor: Editor
): Rect {
  const { origBounds, handle } = d
  const dx = cx - d.startX
  const dy = cy - d.startY
  const aspect =
    shiftKey && origBounds.width > 0 && origBounds.height > 0
      ? origBounds.width / origBounds.height
      : null
  const signed = signedResizeRect(handle, origBounds, dx, dy, aspect)
  if (signed.width <= 0 || signed.height <= 0) {
    optionalEditorState(editor)?.snapGuides.splice(0)
    return { ...signed, width: atLeastOne(signed.width), height: atLeastOne(signed.height) }
  }
  const target = { movingIds: editor.state.selectedIds, parentId: d.parentId }
  return aspect === null
    ? applyBoxResizeSnap(handle, signed, target, editor, ctrlKey)
    : proportionalBoxResizeRect(handle, origBounds, dx, dy, aspect, target, editor, ctrlKey)
}

/** Scales the selection's box with the pointer; Shift keeps its proportions. */
export function applySelectionResize(
  dragState: DragResizeSelection,
  cx: number,
  cy: number,
  shiftKey: boolean,
  editor: Editor,
  ctrlKey = false
) {
  // As in applyResize: reactive drag state must not leak into graph writes.
  const d = toRaw(dragState)
  const { origBounds } = d
  const bounds = resizedBox(d, cx, cy, shiftKey, ctrlKey, editor)
  // A layer locked to its ratio lands on whole pixels in a design, as Figma rounds it.
  const round = roundsToPixels(editor) ? (size: number) => Math.max(1, Math.round(size)) : undefined
  for (const { drag, placement } of d.members) {
    const node = editor.graph.getNode(drag.nodeId)
    if (!node) continue
    const { rotation, flipX, flipY, ...rect } = placeInResizedBounds(
      placement,
      origBounds,
      bounds,
      { keepRatio: drag.lockedAspectRatio !== null, round }
    )
    const changes = { ...scaledChanges(drag, node.type, rect), rotation, flipX, flipY }
    applyResizedRect(drag, node, rect, changes, editor)
  }
  editor.requestRepaint()
}

/** Commits every member's resize, then fits the groups around them once, as one undo step. */
export function commitSelectionResize(dragState: DragResizeSelection, editor: Editor) {
  const d = toRaw(dragState)
  editor.undo.runBatch('Resize', () => {
    // Each commit records a layer's new box and any angle or flip it took, in this one step.
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
