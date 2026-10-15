import type { Rect, Vector } from '../primitives'
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

/**
 * Places a label's plate on a route and cuts the line where it sits: midway along a straight or
 * curved line, and midway along an elbow's longest run, the first of equal runs.
 */
export function placeConnectorLabel(
  pieces: ConnectorPiece[],
  plateSize: { width: number; height: number }
): ConnectorLabelLayout | null {
  if (pieces.length === 0) return null
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
  const t0 = crossing(piece, plate, 0.5, 0)
  const t1 = crossing(piece, plate, 0.5, 1)
  const cut = [
    ...(t0 > EPSILON ? [subPiece(piece, 0, t0)] : []),
    ...(t1 < 1 - EPSILON ? [subPiece(piece, t1, 1)] : [])
  ]
  return { pieces: [...pieces.slice(0, index), ...cut, ...pieces.slice(index + 1)], plate }
}
