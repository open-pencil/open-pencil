import type { Rect, Vector } from '../primitives'
import type { ConnectorLabelPosition } from '../types'
import {
  EPSILON,
  exitPoint,
  isStraight,
  pieceLength,
  pointAt,
  subPiece,
  type ConnectorPiece
} from './pieces'

/** How far a label's plate reaches past its text. */
export const CONNECTOR_LABEL_PADDING = 8.5

function insideRect(point: Vector, rect: Rect): boolean {
  return (
    point.x > rect.x + EPSILON &&
    point.x < rect.x + rect.width - EPSILON &&
    point.y > rect.y + EPSILON &&
    point.y < rect.y + rect.height - EPSILON
  )
}

/** Where a piece running from inside `rect` at `inside` towards `outside` leaves it. */
function crossing(piece: ConnectorPiece, rect: Rect, inside: number, outside: number): number {
  const end = pointAt(piece, outside)
  if (insideRect(end, rect)) return outside
  if (isStraight(piece)) {
    const start = pointAt(piece, inside)
    const exit = exitPoint(rect, start, end)
    const share = Math.hypot(exit.x - start.x, exit.y - start.y) / pieceLength(piece)
    return inside + Math.sign(outside - inside) * share
  }
  let low = inside
  let high = outside
  for (let step = 0; step < 40; step++) {
    const t = (low + high) / 2
    if (insideRect(pointAt(piece, t), rect)) low = t
    else high = t
  }
  return high
}

/** A connector's label plate and the line with the plate's span cut out. */
export interface ConnectorLabelLayout {
  pieces: ConnectorPiece[]
  plate: Rect
}

/** Points sampled along a curved piece to measure and search it. */
const CURVE_SAMPLES = 32

/**
 * How far a label dragged off its line sits from it, centre to line: 0.7 of the plate's extent
 * across the line plus 12.3, fitted to the distances FigJam keeps for plates 31 to 118 across.
 */
const OFF_AXIS_SCALE = 0.7
const OFF_AXIS_OFFSET = 12.3
/**
 * How far past half the plate's extent across the line a dragged label may be from it and stay
 * on it, as FigJam lets it.
 */
const OFF_AXIS_SLACK = 12

/** A piece's length along its curve. */
function lengthOf(piece: ConnectorPiece): number {
  if (isStraight(piece)) return pieceLength(piece)
  let length = 0
  let last = piece.from
  for (let step = 1; step <= CURVE_SAMPLES; step++) {
    const point = pointAt(piece, step / CURVE_SAMPLES)
    length += Math.hypot(point.x - last.x, point.y - last.y)
    last = point
  }
  return length
}

/** Where a route is `distance` along it: which piece, how far into it, and which way it runs. */
function alongRoute(pieces: ConnectorPiece[], distance: number) {
  let left = Math.max(0, distance)
  for (const [index, piece] of pieces.entries()) {
    const length = lengthOf(piece)
    if (left <= length || index === pieces.length - 1) {
      const t = length > 0 ? Math.min(1, left / length) : 0
      return { index, t, point: pointAt(piece, t), direction: directionAt(piece, t) }
    }
    left -= length
  }
  return null
}

function directionAt(piece: ConnectorPiece, t: number): Vector {
  const a = pointAt(piece, Math.max(0, t - 0.001))
  const b = pointAt(piece, Math.min(1, t + 0.001))
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  return length > 0 ? { x: (b.x - a.x) / length, y: (b.y - a.y) / length } : { x: 1, y: 0 }
}

/** The side to the left of a run along `direction`, which FigJam calls above. */
function above(direction: Vector): Vector {
  return { x: direction.y, y: -direction.x }
}

/** A plate's extent across a line running along `direction`. */
function extentAcross(size: { width: number; height: number }, direction: Vector): number {
  return Math.abs(direction.y) * size.width + Math.abs(direction.x) * size.height
}

function plateAt(centre: Vector, size: { width: number; height: number }): Rect {
  return { x: centre.x - size.width / 2, y: centre.y - size.height / 2, ...size }
}

/** Cuts the plate's span out of piece `index`, around the point `t` along it. */
function cutAround(
  pieces: ConnectorPiece[],
  index: number,
  t: number,
  plate: Rect
): ConnectorPiece[] {
  const piece = pieces[index]
  // A line between touching layers has no length to cut; it keeps its one point.
  if (pieceLength(piece) <= EPSILON) return pieces
  const t0 = crossing(piece, plate, t, 0)
  const t1 = crossing(piece, plate, t, 1)
  const cut = [
    ...(t0 > EPSILON ? [subPiece(piece, 0, t0)] : []),
    ...(t1 < 1 - EPSILON ? [subPiece(piece, t1, 1)] : [])
  ]
  return [...pieces.slice(0, index), ...cut, ...pieces.slice(index + 1)]
}

/**
 * A label dragged along its line: its centre `offset` of the way from the middle to an end, by
 * length, cutting the line there, or beside the line, which then runs on uncut.
 */
function placeDragged(
  pieces: ConnectorPiece[],
  size: { width: number; height: number },
  { section, offset, offAxis }: ConnectorLabelPosition
): ConnectorLabelLayout | null {
  const total = pieces.reduce((sum, piece) => sum + lengthOf(piece), 0)
  const half = total / 2
  const at = alongRoute(pieces, half + (section === 'MIDDLE_TO_END' ? offset : -offset) * half)
  if (!at) return null
  if (offAxis === 'NONE') {
    const plate = plateAt(at.point, size)
    return { pieces: cutAround(pieces, at.index, at.t, plate), plate }
  }
  const side = above(at.direction)
  const sign = offAxis === 'ABOVE' ? 1 : -1
  const distance = OFF_AXIS_SCALE * extentAcross(size, at.direction) + OFF_AXIS_OFFSET
  const centre = {
    x: at.point.x + side.x * sign * distance,
    y: at.point.y + side.y * sign * distance
  }
  return { pieces, plate: plateAt(centre, size) }
}

/**
 * Where a label dragged to `point` goes, as FigJam places it: at the nearest point of the line,
 * as a share of the way from the middle towards an end, and beside the line once the point is
 * farther from it than half the plate across plus a little.
 */
export function connectorLabelPositionAt(
  pieces: ConnectorPiece[],
  size: { width: number; height: number },
  point: Vector
): ConnectorLabelPosition | null {
  let best: { distance: number; along: number; direction: Vector; across: number } | null = null
  let before = 0
  for (const piece of pieces) {
    const length = lengthOf(piece)
    const samples = isStraight(piece) ? 1 : CURVE_SAMPLES
    for (let step = 0; step < samples; step++) {
      // The nearest point of each straight stretch, curves taken a stretch at a time.
      const a = pointAt(piece, step / samples)
      const b = pointAt(piece, (step + 1) / samples)
      const dx = b.x - a.x
      const dy = b.y - a.y
      const span = Math.hypot(dx, dy)
      const u =
        span > 0
          ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (span * span)))
          : 0
      const near = { x: a.x + dx * u, y: a.y + dy * u }
      const distance = Math.hypot(point.x - near.x, point.y - near.y)
      if (best && distance >= best.distance - EPSILON) continue
      const direction =
        span > 0 ? { x: dx / span, y: dy / span } : directionAt(piece, step / samples)
      const side = above(direction)
      best = {
        distance,
        along: before + (length * (step + u)) / samples,
        direction,
        across: (point.x - near.x) * side.x + (point.y - near.y) * side.y
      }
    }
    before += length
  }
  if (!best || before <= 0) return null
  const half = before / 2
  const beside = best.distance > extentAcross(size, best.direction) / 2 + OFF_AXIS_SLACK
  const side = best.across > 0 ? 'ABOVE' : 'BELOW'
  return {
    // The middle itself counts towards the start, as FigJam records it.
    section: best.along > half + EPSILON ? 'MIDDLE_TO_END' : 'MIDDLE_TO_START',
    offset: Math.min(1, Math.abs(best.along - half) / half),
    offAxis: beside ? side : 'NONE'
  }
}

/**
 * Places a label's plate on a route and cuts the line where it sits: midway along a straight or
 * curved line, and midway along an elbow's longest run, the first of equal runs, unless it was
 * dragged to a `position` of its own.
 */
export function placeConnectorLabel(
  pieces: ConnectorPiece[],
  plateSize: { width: number; height: number },
  position: ConnectorLabelPosition | null = null
): ConnectorLabelLayout | null {
  if (pieces.length === 0) return null
  if (position) return placeDragged(pieces, plateSize, position)
  let index = 0
  for (let n = 1; n < pieces.length; n++) {
    if (pieceLength(pieces[n]) > pieceLength(pieces[index]) + EPSILON) index = n
  }
  const piece = pieces[index]
  const middle = pointAt(piece, 0.5)
  const plate = {
    x: middle.x - plateSize.width / 2,
    y: middle.y - plateSize.height / 2,
    width: plateSize.width,
    height: plateSize.height
  }
  return { pieces: cutAround(pieces, index, 0.5, plate), plate }
}
