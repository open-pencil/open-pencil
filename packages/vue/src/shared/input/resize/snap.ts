import { resolveEditorProfile, type Editor } from '@open-pencil/core'
import type { HandlePosition } from '@open-pencil/core/geometry'
import type { SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { explicitSnapTargets } from '#vue/shared/input/explicit-snap-targets'
import {
  aspectDriver,
  calculateResizeRect,
  constrainToAspectRatio,
  type AspectDriver
} from '#vue/shared/input/resize/rect'
import {
  optionalEditorState,
  resolveObjectPixelSnap,
  worldBoundsNode
} from '#vue/shared/input/snap'
import type { DragResize } from '#vue/shared/input/types'

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

/** What a handle drag snaps: the layer and the handle that moves its edges. */
type ResizeSnapTarget = Pick<DragResize, 'nodeId' | 'handle'> &
  Partial<Pick<DragResize, 'origRect' | 'origPlacement'>>

/**
 * Where a box from a layer's handle drag lies on the canvas. The box keeps the layer's starting
 * frame, so it maps through the frame the drag started in; a mirrored layer's right handle then
 * moves the canvas's left edge, as it does once placed.
 */
function canvasBounds(drag: ResizeSnapTarget, node: SceneNode, rect: Rect, editor: Editor): Rect {
  const { origRect, origPlacement } = drag
  if (!origRect || !origPlacement)
    return getAxisAlignedWorldBounds({ ...node, ...rect }, editor.graph)
  const x = rect.x - origRect.x
  const y = rect.y - origRect.y
  const [ax, ay, bx, by] = Matrix.mapPoints(origPlacement.world, [
    x,
    y,
    x + rect.width,
    y + rect.height
  ])
  // An axis-aligned frame, which snapping requires, maps the box's opposite corners to its bounds.
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay)
  }
}

function resizeTargets(drag: ResizeSnapTarget, editor: Editor): SceneNode[] {
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

function hasAxisAlignedWorldBasis(matrix: Mat3): boolean {
  return Math.abs(matrix[1]) <= 1e-6 && Math.abs(matrix[3]) <= 1e-6
}

const MIRRORED_HANDLE: Record<HandlePosition, HandlePosition> = {
  nw: 'ne',
  ne: 'nw',
  sw: 'se',
  se: 'sw',
  n: 'n',
  s: 's',
  e: 'w',
  w: 'e'
}

const FLIPPED_HANDLE: Record<HandlePosition, HandlePosition> = {
  nw: 'sw',
  sw: 'nw',
  ne: 'se',
  se: 'ne',
  n: 's',
  s: 'n',
  e: 'e',
  w: 'w'
}

/**
 * The canvas edge a layer's own handle moves: on a layer drawn mirrored or turned half round, its
 * right handle moves the edge on the canvas's left.
 */
function canvasHandle(handle: HandlePosition, world: Mat3): HandlePosition {
  const across = world[0] < 0 ? MIRRORED_HANDLE[handle] : handle
  return world[4] < 0 ? FLIPPED_HANDLE[across] : across
}

export function applyResizeSnap(
  drag: ResizeSnapTarget,
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
  const world = getWorldMatrix(node, editor.graph)
  if (!hasAxisAlignedWorldBasis(world)) {
    editor.state.snapGuides = []
    return rect
  }
  const worldBounds = canvasBounds(drag, node, rect, editor)
  const activeBounds = activeEdgeBounds(canvasHandle(drag.handle, world), worldBounds)
  const snap = resolveObjectPixelSnap(
    new Set([drag.nodeId]),
    activeBounds,
    resizeTargets(drag, editor),
    editor,
    explicitSnapTargets(node.parentId, editor)
  )
  const horizontal = movesLeft(drag.handle) || movesRight(drag.handle)
  const vertical = movesTop(drag.handle) || movesBottom(drag.handle)
  // The correction along the layer's own axes, which run against the canvas's when it is mirrored.
  const dx = horizontal ? snap.correction.x / world[0] : 0
  const dy = vertical ? snap.correction.y / world[4] : 0

  // Only the axes the handle moves snap, so only their guides show.
  state.snapGuides = snap.guides.filter((guide) => (guide.axis === 'x' ? horizontal : vertical))
  return applyEdgeDelta(drag.handle, rect, dx, dy)
}

/** What a multi-selection's box snaps against: its layers, and the parent whose layers it meets. */
export interface BoxSnapTarget {
  movingIds: Set<string>
  parentId: string
}

/**
 * Snaps the edges a handle moves on a multi-selection's canvas box to other layers' edges, the
 * guides, and the grid, as a single layer's resize does; the box is already on the canvas.
 */
export function applyBoxResizeSnap(
  handle: HandlePosition,
  box: Rect,
  target: BoxSnapTarget,
  editor: Editor,
  disableSnapping: boolean
): Rect {
  const state = optionalEditorState(editor)
  if (disableSnapping || !state) {
    if (state) state.snapGuides = []
    return box
  }
  const targets = editor.graph
    .getChildren(target.parentId)
    .filter((candidate) => candidate.visible)
    .map((candidate) => worldBoundsNode(candidate, editor))
  const snap = resolveObjectPixelSnap(
    target.movingIds,
    activeEdgeBounds(handle, box),
    targets,
    editor,
    explicitSnapTargets(target.parentId, editor)
  )
  const horizontal = movesLeft(handle) || movesRight(handle)
  const vertical = movesTop(handle) || movesBottom(handle)
  state.snapGuides = snap.guides.filter((guide) => (guide.axis === 'x' ? horizontal : vertical))
  return applyEdgeDelta(
    handle,
    box,
    horizontal ? snap.correction.x : 0,
    vertical ? snap.correction.y : 0
  )
}

/** How much a drag along one axis grows the box: by the delta at its far edge, against it at its near one. */
function edgeGrowth(delta: number, far: boolean, near: boolean): number {
  if (far) return delta
  return near ? -delta : 0
}

/** The edge a proportional drag snaps by: the one its driving side moves. */
const DRIVING_EDGE: Record<HandlePosition, Record<AspectDriver, HandlePosition>> = {
  nw: { width: 'w', height: 'n' },
  ne: { width: 'e', height: 'n' },
  sw: { width: 'w', height: 's' },
  se: { width: 'e', height: 's' },
  n: { width: 'n', height: 'n' },
  s: { width: 's', height: 's' },
  e: { width: 'e', height: 'e' },
  w: { width: 'w', height: 'w' }
}

/**
 * Sizes a box kept at `aspect` from a handle drag, snapping as Figma does: the side that drives
 * lands on the grid and on other layers' edges as a free resize's edge would, and the other side
 * follows the ratio, rounded to a whole pixel in a design and left as it falls on a board.
 */
/** The size a drag gives the box before its ratio is kept. */
function draggedSize(handle: HandlePosition, origRect: Rect, dx: number, dy: number) {
  return {
    width: origRect.width + edgeGrowth(dx, movesRight(handle), movesLeft(handle)),
    height: origRect.height + edgeGrowth(dy, movesBottom(handle), movesTop(handle))
  }
}

/**
 * The side that drives a ratio-locked resize, which {@link proportionalResizeRect} snaps; the
 * other follows it and may be rounded.
 */
export function proportionalResizeDriver(
  handle: HandlePosition,
  origRect: Rect,
  dx: number,
  dy: number,
  aspect: number
): AspectDriver {
  const { width, height } = draggedSize(handle, origRect, dx, dy)
  return aspectDriver(handle, width, height, aspect)
}

export function proportionalResizeRect(
  drag: ResizeSnapTarget,
  origRect: Rect,
  dx: number,
  dy: number,
  aspect: number,
  editor: Editor,
  disableSnapping: boolean
): Rect {
  return proportionalRect(
    drag.handle,
    origRect,
    dx,
    dy,
    aspect,
    editor,
    disableSnapping,
    (edge, rect) => applyResizeSnap({ ...drag, handle: edge }, rect, editor, false)
  )
}

/** {@link proportionalResizeRect} for a multi-selection's canvas box. */
export function proportionalBoxResizeRect(
  handle: HandlePosition,
  origBox: Rect,
  dx: number,
  dy: number,
  aspect: number,
  target: BoxSnapTarget,
  editor: Editor,
  disableSnapping: boolean
): Rect {
  return proportionalRect(handle, origBox, dx, dy, aspect, editor, disableSnapping, (edge, box) =>
    applyBoxResizeSnap(edge, box, target, editor, false)
  )
}

function proportionalRect(
  handle: HandlePosition,
  origRect: Rect,
  dx: number,
  dy: number,
  aspect: number,
  editor: Editor,
  disableSnapping: boolean,
  snapEdge: (edge: HandlePosition, rect: Rect) => Rect
): Rect {
  const constrained = calculateResizeRect(handle, origRect, dx, dy, aspect)
  const state = optionalEditorState(editor)
  const { width, height } = draggedSize(handle, origRect, dx, dy)
  // A handle dragged past the opposite edge flips the box; it lands where the pointer puts it.
  if (disableSnapping || !state || width <= 0 || height <= 0) {
    if (state) state.snapGuides = []
    return constrained
  }
  const driver = proportionalResizeDriver(handle, origRect, dx, dy, aspect)
  const snapped = snapEdge(DRIVING_EDGE[handle][driver], constrained)
  const roundsToPixels =
    state.snappingPreferences.pixelGrid && resolveEditorProfile(state).pixelGrid
  const fitted = constrainToAspectRatio(
    handle,
    origRect,
    snapped.width,
    snapped.height,
    aspect,
    driver,
    roundsToPixels ? (size) => Math.max(1, Math.round(size)) : undefined
  )
  // The smallest box the ratio allows moved the snapped side off its guide.
  if (fitted[driver] !== snapped[driver]) state.snapGuides = []
  return fitted
}
