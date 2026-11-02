import { minBy } from 'es-toolkit'

import type { Vector, Rect } from '@open-pencil/scene-graph/primitives'

/**
 * Where a selected layer takes the pointer for resizing and rotating, as Figma desktop measures
 * it, in screen pixels in the layer's own frame. Every edge resizes along a band that reaches
 * `resizeReach` outside it and short of a tenth of the side inside it; a corner resizes within
 * `resizeReach` of it, and rotates outside the layer within `rotateReach` of it.
 */
export const TRANSFORM_ZONE = {
  /** How far outside an edge, and around a corner, the pointer resizes. */
  resizeReach: 7.5,
  /** The share of a side its edge bands reach inside the layer, short of it and of `innerMax`. */
  innerShare: 0.1,
  innerMax: 8,
  /** A layer with a side shorter than this keeps its bands and corners outside it. */
  innerMinSide: 24,
  /** A layer with both sides shorter than this takes no resize or rotation. */
  minSide: 10,
  /** Such a layer, selected, takes a press within a span this long centred on it, either way. */
  tinyHitSpan: 16,
  /** How far from a corner, outside the layer, the pointer rotates. */
  rotateReach: 16
} as const

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export type CornerPosition = 'nw' | 'ne' | 'se' | 'sw'

export type TransformZone =
  | { kind: 'resize'; handle: HandlePosition }
  | { kind: 'rotate'; corner: CornerPosition }

type Edge = 'w' | 'e' | 'n' | 's'

interface Corner {
  handle: CornerPosition
  /** The vertical and the horizontal edge that meet at the corner. */
  x: Edge
  y: Edge
}

const CORNERS: readonly Corner[] = [
  { handle: 'nw', x: 'w', y: 'n' },
  { handle: 'ne', x: 'e', y: 'n' },
  { handle: 'se', x: 'e', y: 's' },
  { handle: 'sw', x: 'w', y: 's' }
]

/** Vertical edges first: at a small layer's corner, Figma resizes its width. */
const EDGES: readonly Edge[] = ['w', 'e', 'n', 's']

/** A point against a selected layer, in screen pixels in the layer's own frame. */
interface ZoneFrame {
  width: number
  height: number
  x: number
  y: number
  /** How far outside each edge the point lies; negative inside. */
  outside: Record<Edge, number>
  /** A side under `innerMinSide` keeps every band outside the layer. */
  small: boolean
}

/** How far an edge band reaches inside the layer. */
function innerReach(frame: ZoneFrame, edge: Edge) {
  if (frame.small) return 0
  const side = edge === 'w' || edge === 'e' ? frame.width : frame.height
  return Math.min(TRANSFORM_ZONE.innerMax, side * TRANSFORM_ZONE.innerShare)
}

function inBand(frame: ZoneFrame, edge: Edge) {
  const vertical = edge === 'w' || edge === 'e'
  const along = vertical ? frame.y : frame.x
  const across = frame.outside[edge]
  const limit = innerReach(frame, edge)
  // A small layer's bands start where the layer ends: its left and top edges are inside it, its
  // right and bottom ones beyond it. A larger layer's bands stop short of their inner reach.
  const startsBeyond = edge === 'e' || edge === 's' ? across >= 0 : across > 0
  return (
    across <= TRANSFORM_ZONE.resizeReach &&
    (limit === 0 ? startsBeyond : -across < limit) &&
    along >= 0 &&
    along <= (vertical ? frame.height : frame.width)
  )
}

function resizesCorner(frame: ZoneFrame, corner: Corner) {
  const reach = TRANSFORM_ZONE.resizeReach
  const dx = frame.outside[corner.x]
  const dy = frame.outside[corner.y]
  const distance = Math.hypot(dx, dy)
  // A small layer's corners take the pointer only beyond both of its edges.
  if (frame.small) return dx > 0 && dy > 0 && distance <= reach
  return (
    distance <= reach ||
    (inBand(frame, corner.x) && Math.abs(dy) <= reach) ||
    (inBand(frame, corner.y) && Math.abs(dx) <= reach)
  )
}

/** The corner nearest a point outside the layer within `rotateReach` of it. */
function rotatedCorner(frame: ZoneFrame): CornerPosition | null {
  const { outside } = frame
  if (outside.w <= 0 && outside.e <= 0 && outside.n <= 0 && outside.s <= 0) return null
  const distance = (corner: Corner) => Math.hypot(outside[corner.x], outside[corner.y])
  const nearest = minBy(CORNERS, distance)
  return nearest && distance(nearest) <= TRANSFORM_ZONE.rotateReach ? nearest.handle : null
}

/** Whether a layer of this size on screen shows and takes resize and rotation handles. */
export function hasTransformHandles(width: number, height: number): boolean {
  return width >= TRANSFORM_ZONE.minSide || height >= TRANSFORM_ZONE.minSide
}

/**
 * The zone under a point given in the layer's own frame, with the layer's rect in that frame and
 * the zoom that maps it to the screen; `null` where the pointer neither resizes nor rotates.
 */
export function transformZoneAt(point: Vector, rect: Rect, zoom: number): TransformZone | null {
  const width = rect.width * zoom
  const height = rect.height * zoom
  if (!hasTransformHandles(width, height)) return null
  const x = (point.x - rect.x) * zoom
  const y = (point.y - rect.y) * zoom
  const frame: ZoneFrame = {
    width,
    height,
    x,
    y,
    outside: { w: -x, e: x - width, n: -y, s: y - height },
    small: width < TRANSFORM_ZONE.innerMinSide || height < TRANSFORM_ZONE.innerMinSide
  }
  const corner = CORNERS.find((candidate) => resizesCorner(frame, candidate))
  if (corner) return { kind: 'resize', handle: corner.handle }
  const edge = EDGES.find((candidate) => inBand(frame, candidate))
  if (edge) return { kind: 'resize', handle: edge }
  const rotated = rotatedCorner(frame)
  return rotated ? { kind: 'rotate', corner: rotated } : null
}

/**
 * Whether a selected layer too small for handles takes a press at a point in its own frame, as
 * Figma widens it: to `tinyHitSpan` across its centre along either axis, within its extent along
 * the other.
 */
export function pressesTinyLayer(point: Vector, rect: Rect, zoom: number): boolean {
  const width = rect.width * zoom
  const height = rect.height * zoom
  if (hasTransformHandles(width, height)) return false
  const x = (point.x - rect.x) * zoom
  const y = (point.y - rect.y) * zoom
  const half = TRANSFORM_ZONE.tinyHitSpan / 2
  const across = (offset: number, side: number) =>
    Math.abs(offset - side / 2) <= Math.max(half, side / 2)
  const within = (offset: number, side: number) => offset >= 0 && offset <= side
  return (across(x, width) && within(y, height)) || (within(x, width) && across(y, height))
}
