import { resolveEditorProfile, type Editor } from '@open-pencil/core'
import type { HandlePosition } from '@open-pencil/core/geometry'
import type { SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import { explicitSnapTargets } from '#vue/shared/input/explicit-snap-targets'
import {
  aspectDriver,
  atLeastOne,
  calculateResizeRect,
  constrainToAspectRatio,
  signedResizeRect,
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

/**
 * What a handle drag resizes and snaps against: a layer's box in its own frame, or a selection's
 * box already on the canvas. Everything else about the drag is the same for both.
 */
export interface ResizeSnapSource {
  movingIds: ReadonlySet<string>
  /** The layer whose children the box snaps to, and whose guides it meets. */
  parentId: string
  /**
   * The box on the canvas, the handle that moves its edges there, and a canvas correction along
   * the box's own axes; null when it cannot snap: the current snapping model is axis-aligned, so a
   * turned frame does not snap.
   */
  onCanvas(handle: HandlePosition, rect: Rect): CanvasBox | null
  /**
   * Where the side a handle leaves rounds from: a layer keeps its top or left edge, a selection's
   * box its center, as Figma rounds them.
   */
  roundsFrom: 'start' | 'center'
}

interface CanvasBox {
  bounds: Rect
  handle: HandlePosition
  toBox(correction: Vector): Vector
}

/** What a layer's handle drag snaps: the layer and the handle that moves its edges. */
type LayerSnapTarget = Pick<DragResize, 'nodeId' | 'handle'> &
  Partial<Pick<DragResize, 'origRect' | 'origPlacement'>>

/**
 * A layer resized in its own frame. Its box keeps the frame the drag started in, so it maps through
 * that frame; a mirrored layer's right handle then moves the canvas's left edge, as it does once
 * placed.
 */
export function layerSnapSource(drag: LayerSnapTarget, editor: Editor): ResizeSnapSource {
  return {
    movingIds: new Set([drag.nodeId]),
    parentId: editor.graph.getNode(drag.nodeId)?.parentId ?? editor.state.currentPageId,
    roundsFrom: 'start',
    onCanvas(handle, rect) {
      // The layer as the drag has it now: its preview changes as the pointer moves.
      const node = editor.graph.getNode(drag.nodeId)
      if (!node) return null
      const world = getWorldMatrix(node, editor.graph)
      if (!hasAxisAlignedWorldBasis(world)) return null
      return {
        bounds: layerCanvasBounds(drag, node, rect, editor),
        handle: canvasHandle(handle, world),
        // Along the layer's own axes, which run against the canvas's when it is mirrored.
        toBox: (correction) => ({ x: correction.x / world[0], y: correction.y / world[4] })
      }
    }
  }
}

function layerCanvasBounds(
  drag: LayerSnapTarget,
  node: SceneNode,
  rect: Rect,
  editor: Editor
): Rect {
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

/** A multi-selection's box, which is already on the canvas. */
export function selectionSnapSource(
  movingIds: ReadonlySet<string>,
  parentId: string
): ResizeSnapSource {
  return {
    movingIds,
    parentId,
    roundsFrom: 'center',
    onCanvas: (handle, bounds) => ({ bounds, handle, toBox: (correction) => correction })
  }
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

/** Whether drags land on whole pixels: Snap to pixel grid is on, in a design rather than a board. */
export function roundsToPixels(editor: Editor): boolean {
  const state = optionalEditorState(editor)
  return (
    state !== undefined &&
    state.snappingPreferences.pixelGrid &&
    resolveEditorProfile(state).pixelGrid
  )
}

/** A size in whole pixels, at least one. */
export function wholePixels(size: number): number {
  return Math.max(1, Math.round(size))
}

/**
 * The box with whole-pixel sides, as Figma rounds a box a handle resizes: the edges a handle moves
 * give way and the ones it leaves stay, so a fractional position survives; a side the handle does
 * not move rounds too, from `roundsFrom`.
 */
function wholePixelSize(
  handle: HandlePosition,
  rect: Rect,
  axes: { x: boolean; y: boolean },
  roundsFrom: ResizeSnapSource['roundsFrom']
): Rect {
  let { x, y, width, height } = rect
  const horizontal = movesLeft(handle) || movesRight(handle)
  const vertical = movesTop(handle) || movesBottom(handle)
  if (axes.x) {
    const rounded = wholePixels(width)
    if (movesLeft(handle)) x += width - rounded
    else if (!horizontal && roundsFrom === 'center') x += (width - rounded) / 2
    width = rounded
  }
  if (axes.y) {
    const rounded = wholePixels(height)
    if (movesTop(handle)) y += height - rounded
    else if (!vertical && roundsFrom === 'center') y += (height - rounded) / 2
    height = rounded
  }
  return { x, y, width, height }
}

/**
 * Snaps the edges a handle moves to other layers' edges and the guides, and lands the box on whole
 * pixels where none of them claims an axis: Figma rounds the box's size, not its edge, and the
 * edges the handle leaves stay where they are.
 */
export function snapResizedEdges(
  handle: HandlePosition,
  rect: Rect,
  source: ResizeSnapSource,
  editor: Editor,
  disableSnapping: boolean
): Rect {
  const state = optionalEditorState(editor)
  if (disableSnapping || !state) {
    if (state) state.snapGuides = []
    return rect
  }
  const canvas = source.onCanvas(handle, rect)
  if (!canvas) {
    state.snapGuides = []
    return rect
  }
  const targets = editor.graph
    .getChildren(source.parentId)
    .filter((candidate) => candidate.visible && !source.movingIds.has(candidate.id))
    .map((candidate) => worldBoundsNode(candidate, editor))
  const snap = resolveObjectPixelSnap(
    new Set(source.movingIds),
    activeEdgeBounds(canvas.handle, canvas.bounds),
    targets,
    editor,
    explicitSnapTargets(source.parentId, editor)
  )
  const horizontal = movesLeft(handle) || movesRight(handle)
  const vertical = movesTop(handle) || movesBottom(handle)
  const correction = canvas.toBox(snap.correction)
  const dx = horizontal ? correction.x : 0
  const dy = vertical ? correction.y : 0
  // Only the axes the handle moves snap, so only their guides show.
  state.snapGuides = snap.guides.filter((guide) => (guide.axis === 'x' ? horizontal : vertical))
  if (!roundsToPixels(editor)) return applyEdgeDelta(handle, rect, dx, dy)
  // Pixel rounding draws no guide, so a guide on an axis marks an edge that met a layer or guide.
  const meetsX = horizontal && state.snapGuides.some((guide) => guide.axis === 'x')
  const meetsY = vertical && state.snapGuides.some((guide) => guide.axis === 'y')
  const snapped = applyEdgeDelta(handle, rect, meetsX ? dx : 0, meetsY ? dy : 0)
  return wholePixelSize(handle, snapped, { x: !meetsX, y: !meetsY }, source.roundsFrom)
}

/**
 * The box a handle drag gives a layer or a selection, with signed sizes, as Figma resizes both: a
 * press that has not moved leaves it; dragged past the opposite edge, it comes out mirrored where
 * the pointer puts it; a kept ratio drives from one side; otherwise its moving edges snap.
 */
export function resizedRect(
  handle: HandlePosition,
  origRect: Rect,
  delta: Vector,
  aspect: number | null,
  source: ResizeSnapSource,
  editor: Editor,
  disableSnapping: boolean
): Rect {
  const { x: dx, y: dy } = delta
  if (dx === 0 && dy === 0) return origRect
  const signed = signedResizeRect(handle, origRect, dx, dy, aspect)
  if (signed.width < 0 || signed.height < 0) {
    optionalEditorState(editor)?.snapGuides.splice(0)
    return { ...signed, width: atLeastOne(signed.width), height: atLeastOne(signed.height) }
  }
  return aspect !== null
    ? proportionalResizeRect(handle, origRect, dx, dy, aspect, source, editor, disableSnapping)
    : snapResizedEdges(
        handle,
        calculateResizeRect(handle, origRect, dx, dy, null),
        source,
        editor,
        disableSnapping
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

/**
 * Sizes a box kept at `aspect` from a handle drag, snapping as Figma does: the side that drives
 * lands on the grid and on other layers' edges as a free resize's edge would, and the other side
 * follows the ratio, rounded to a whole pixel in a design and left as it falls on a board.
 */
export function proportionalResizeRect(
  handle: HandlePosition,
  origRect: Rect,
  dx: number,
  dy: number,
  aspect: number,
  source: ResizeSnapSource,
  editor: Editor,
  disableSnapping: boolean
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
  const snapped = snapResizedEdges(DRIVING_EDGE[handle][driver], constrained, source, editor, false)
  const fitted = constrainToAspectRatio(
    handle,
    origRect,
    snapped.width,
    snapped.height,
    aspect,
    driver,
    roundsToPixels(editor) ? wholePixels : undefined
  )
  // The smallest box the ratio allows moved the snapped side off its guide.
  if (fitted[driver] !== snapped[driver]) state.snapGuides = []
  return fitted
}
