import { toRaw } from 'vue'

import type { Editor } from '@open-pencil/core'
import { resolveEditorProfile } from '@open-pencil/core'
import type { HandlePosition } from '@open-pencil/core/geometry'
import type { SceneNode } from '@open-pencil/scene-graph'
import {
  canvasDeltaInLayer,
  getAxisAlignedWorldBounds,
  placeScaledAbout,
  selectionPlacement
} from '@open-pencil/scene-graph/coordinate'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import {
  MIN_RESCALE,
  rescaleNodeChanges,
  rescaleTargets,
  scaleRoots
} from '@open-pencil/scene-graph/scaling'

import { getHitHandleByMatrix } from '#vue/shared/input/geometry'
import { selectionResizeHandleAt } from '#vue/shared/input/resize/selection'
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

/** The handle a press is on: a single layer's own, or the box of a multi-selection. */
function pressedHandle(
  cx: number,
  cy: number,
  roots: readonly SceneNode[],
  editor: Editor
): HandlePosition | null {
  if (editor.state.selectedIds.size > 1) return selectionResizeHandleAt(cx, cy, editor)
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

  const placements = new Map(roots.map((root) => [root.id, selectionPlacement(root, editor.graph)]))
  const originals = new Map<string, SceneNode>()
  for (const root of roots) {
    for (const node of rescaleTargets(editor.graph, root, { keepLocked: true }))
      originals.set(node.id, { ...node })
  }
  const single = roots.length === 1 && editor.state.selectedIds.size === 1 ? roots[0] : null
  const layerPlacement = single && placements.get(single.id)
  const drag: DragScale = {
    type: 'scale',
    handle,
    startX: cx,
    startY: cy,
    origRect: single
      ? { x: single.x, y: single.y, width: single.width, height: single.height }
      : computeBounds(roots.map((root) => getAxisAlignedWorldBounds(root, editor.graph))),
    layer: single && layerPlacement ? { nodeId: single.id, origPlacement: layerPlacement } : null,
    placements,
    originals,
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
  const { origRect, layer, handle } = d
  if (origRect.width <= 0 || origRect.height <= 0) return
  const aspect = origRect.width / origRect.height
  const canvasDelta = { x: cx - d.startX, y: cy - d.startY }
  const delta = layer
    ? canvasDeltaInLayer(layer.origPlacement, canvasDelta.x, canvasDelta.y)
    : canvasDelta
  // From the center, the handle's side moves by the pointer and the opposite one mirrors it.
  const reach = centred ? 2 : 1
  const [dx, dy] = [delta.x * reach, delta.y * reach]
  const source = layer
    ? layerSnapSource(
        { nodeId: layer.nodeId, handle, origRect, origPlacement: layer.origPlacement },
        editor
      )
    : selectionSnapSource(new Set(d.placements.keys()), editor.state.currentPageId)
  const rect = proportionalResizeRect(
    handle,
    origRect,
    dx,
    dy,
    aspect,
    source,
    editor,
    disableSnapping || centred
  )
  const driver = proportionalResizeDriver(handle, origRect, dx, dy, aspect)
  d.scale = Math.max(MIN_RESCALE, rect[driver] / origRect[driver])
  d.anchorFraction = centred ? { x: 0.5, y: 0.5 } : handleAnchor(handle)
  d.anchor = boxPoint(d, d.anchorFraction)
  previewScale(d, d.scale, editor)
  editor.requestRepaint()
}

/** Shows every layer of the drag at `scale` about the drag's anchor. */
function previewScale(d: DragScale, scale: number, editor: Editor) {
  for (const [id, original] of d.originals) {
    const placement = d.placements.get(id)
    const changes = rescaleNodeChanges(editor.graph, original, scale, placement !== undefined)
    // Back at its own size, a layer takes back exactly the place it started from.
    if (placement) {
      const { x, y } = scale === 1 ? original : placeScaledAbout(placement, d.anchor, scale)
      Object.assign(changes, { x, y })
    }
    editor.graph.updateNodePreview(id, changes)
  }
}

function commitScale(drag: DragScale, editor: Editor) {
  const d = toRaw(drag)
  previewScale(d, 1, editor)
  editor.setSnapGuides([])
  editor.setScaleAnchor(d.anchorFraction)
  if (d.scale !== 1) editor.scaleSelected(d.scale, d.anchor)
  editor.requestRender()
}

function cancelScale(drag: DragScale, editor: Editor) {
  previewScale(toRaw(drag), 1, editor)
  editor.setSnapGuides([])
  editor.requestRender()
}
