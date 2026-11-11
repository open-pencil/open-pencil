import { toRaw } from 'vue'

import type { Editor } from '@open-pencil/core'
import { resolveEditorProfile } from '@open-pencil/core'
import type { HandlePosition } from '@open-pencil/core/geometry'
import type { SceneNode } from '@open-pencil/scene-graph'
import { canvasDeltaInLayer, getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import {
  MIN_RESCALE,
  scaledSnapshotChanges,
  scaleRoots,
  snapshotScale,
  type ScaleSnapshot
} from '@open-pencil/scene-graph/scaling'

import { getHitHandleByMatrix } from '#vue/shared/input/geometry'
import { lineEndAt } from '#vue/shared/input/line/end'
import { selectionBox, selectionResizeHandleAt } from '#vue/shared/input/resize/selection'
import {
  layerSnapSource,
  proportionalResizeDriver,
  proportionalResizeRect,
  selectionSnapSource
} from '#vue/shared/input/resize/snap'
import type { DragScale } from '#vue/shared/input/types'

/** How a pointer move scales: Alt from the box's center, Control without snapping. */
export interface ScaleModifiers {
  centred: boolean
  disableSnapping: boolean
}

/** Where along an axis a handle keeps the box: the far side from the one it moves, else the middle. */
function keptAlong(movesStart: boolean, movesEnd: boolean): number {
  if (movesStart) return 1
  return movesEnd ? 0 : 0.5
}

/** The point of the box a handle keeps in place, as fractions of its width and height. */
function handleAnchor(handle: HandlePosition): Vector {
  return {
    x: keptAlong(handle.includes('w'), handle.includes('e')),
    y: keptAlong(
      handle === 'nw' || handle === 'n' || handle === 'ne',
      handle === 'sw' || handle === 's' || handle === 'se'
    )
  }
}

/** A point of the drag's box, given as fractions of its size, on the canvas. */
function boxPoint(d: DragScale, fraction: Vector): Vector {
  const { origRect, layer } = d
  const x = fraction.x * origRect.width
  const y = fraction.y * origRect.height
  if (!layer) return { x: origRect.x + x, y: origRect.y + y }
  const [px, py] = Matrix.mapPoints(layer.origPlacement.world, [x, y])
  return { x: px, y: py }
}

/**
 * The handle a press is on: a single layer's own, where a line's ends stand for its sides, or the
 * box of a multi-selection.
 */
function pressedHandle(
  cx: number,
  cy: number,
  roots: readonly SceneNode[],
  editor: Editor
): HandlePosition | null {
  if (editor.state.selectedIds.size > 1) return selectionResizeHandleAt(cx, cy, editor)
  const lineEnd = lineEndAt(editor, cx, cy)
  if (lineEnd) return lineEnd.end === 'end' ? 'e' : 'w'
  const hit = getHitHandleByMatrix(
    cx,
    cy,
    roots[0],
    editor.graph,
    editor.renderer?.zoom,
    editor.state.rotationPreview
  )
  return hit?.handle ?? null
}

/**
 * Starts Figma's Scale drag from a handle of the selection. A single layer scales in its own
 * frame, whatever its angle; several scale together in their box on the canvas.
 */
export function tryStartScale(cx: number, cy: number, editor: Editor): DragScale | null {
  if (resolveEditorProfile(editor.state).layerEdits !== 'all') return null
  const roots = scaleRoots(editor.graph, editor.getSelectedNodes())
  if (roots.length === 0) return null
  const handle = pressedHandle(cx, cy, roots, editor)
  if (!handle) return null

  const snapshot = snapshotScale(editor.graph, roots)
  const single = roots.length === 1 && editor.state.selectedIds.size === 1 ? roots[0] : null
  const layerPlacement = single && snapshot.roots.get(single.id)
  const drag: DragScale = {
    type: 'scale',
    handle,
    startX: cx,
    startY: cy,
    origRect: single
      ? { x: single.x, y: single.y, width: single.width, height: single.height }
      : // The box the handles are drawn on, locked layers included, as a resize takes it.
        (selectionBox(editor) ??
        computeBounds(roots.map((root) => getAxisAlignedWorldBounds(root, editor.graph)))),
    layer: single && layerPlacement ? { nodeId: single.id, origPlacement: layerPlacement } : null,
    snapshot,
    preview: createScalePreview(editor, snapshot),
    scale: 1,
    anchorFraction: handleAnchor(handle),
    anchor: { x: cx, y: cy },
    commit: () => commitScale(drag, editor),
    cancel: () => cancelScale(drag, editor)
  }
  drag.anchor = boxPoint(drag, drag.anchorFraction)
  return drag
}

/**
 * Shows the selection scaled from the handle; only the commit records it. The side the pointer
 * leads snaps as a Shift-resize's does, and the scale follows it.
 */
export function applyScale(
  drag: DragScale,
  cx: number,
  cy: number,
  editor: Editor,
  { centred, disableSnapping }: ScaleModifiers
) {
  const d = toRaw(drag)
  const { origRect, layer } = d
  if (origRect.width <= 0) return
  const canvasDelta = { x: cx - d.startX, y: cy - d.startY }
  const delta = layer
    ? canvasDeltaInLayer(layer.origPlacement, canvasDelta.x, canvasDelta.y)
    : canvasDelta
  // From the center, the handle's side moves by the pointer and the opposite one mirrors it.
  const reach = centred ? 2 : 1
  const scale =
    origRect.height > 0
      ? boxScale(d, delta.x * reach, delta.y * reach, editor, centred || disableSnapping)
      : lineScale(d, delta.x * reach)
  // A degenerate frame can give no finite scale; the preview keeps its last step.
  if (!Number.isFinite(scale)) return
  d.scale = Math.max(MIN_RESCALE, scale)
  d.anchorFraction = centred ? { x: 0.5, y: 0.5 } : handleAnchor(d.handle)
  d.anchor = boxPoint(d, d.anchorFraction)
  d.preview.show(d.scale, d.anchor)
}

/** A line has no height: the end dragged along it sets its length, and the scale with it. */
function lineScale(d: DragScale, dx: number): number {
  const grown = d.handle === 'w' ? -dx : dx
  return (d.origRect.width + grown) / d.origRect.width
}

/** The scale a box kept at its ratio takes, from the side that leads and snaps. */
function boxScale(
  d: DragScale,
  dx: number,
  dy: number,
  editor: Editor,
  disableSnapping: boolean
): number {
  const { origRect, layer, handle } = d
  const aspect = origRect.width / origRect.height
  const source = layer
    ? layerSnapSource(
        { nodeId: layer.nodeId, handle, origRect, origPlacement: layer.origPlacement },
        editor
      )
    : selectionSnapSource(new Set(d.snapshot.roots.keys()), editor.state.currentPageId)
  const rect = proportionalResizeRect(
    handle,
    origRect,
    dx,
    dy,
    aspect,
    source,
    editor,
    disableSnapping
  )
  const driver = proportionalResizeDriver(handle, origRect, dx, dy, aspect)
  return rect[driver] / origRect[driver]
}

/**
 * A Scale edit shown on the canvas while a drag or a scrubbed field changes it, and recorded as one
 * undo step when it ends. Every step scales the snapshot, not the step before it.
 */
export interface ScalePreview {
  /** Shows the layers at `scale` about a canvas point. */
  show(scale: number, anchor: Vector): void
  /** Puts the layers back and records the last step shown, if it changed anything. */
  commit(): void
  /** Puts the layers back as the snapshot found them. */
  cancel(): void
}

export function createScalePreview(editor: Editor, snapshot: ScaleSnapshot): ScalePreview {
  let shown: { scale: number; anchor: Vector } | null = null
  const place = (scale: number, anchor: Vector) => {
    for (const [id, changes] of scaledSnapshotChanges(editor.graph, snapshot, scale, anchor))
      editor.graph.updateNodePreview(id, changes)
  }
  const restore = () => {
    if (shown) place(1, shown.anchor)
  }
  return {
    show(scale, anchor) {
      shown = { scale, anchor }
      place(scale, anchor)
      editor.requestRepaint()
    },
    commit() {
      restore()
      const last = shown
      shown = null
      if (last && last.scale !== 1) editor.scaleSelected(last.scale, last.anchor)
      editor.requestRender()
    },
    cancel() {
      restore()
      shown = null
      editor.requestRender()
    }
  }
}

function commitScale(drag: DragScale, editor: Editor) {
  const d = toRaw(drag)
  editor.setSnapGuides([])
  editor.setScaleAnchor(d.anchorFraction)
  d.preview.commit()
}

function cancelScale(drag: DragScale, editor: Editor) {
  editor.setSnapGuides([])
  toRaw(drag).preview.cancel()
}
