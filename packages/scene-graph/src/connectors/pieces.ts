import { computeBounds } from '../geometry'
import type { Rect, Vector } from '../primitives'
import type { StrokeCap, VectorNetwork } from '../types'

/** One piece of a route: a straight run when both handles are zero, else a cubic. */
export interface ConnectorPiece {
  from: Vector
  to: Vector
  handleFrom: Vector
  handleTo: Vector
}

export const ZERO: Vector = { x: 0, y: 0 }
export const EPSILON = 1e-6
/** Points sampled along a curved piece to bound it. */
const CURVE_BOUND_SAMPLES = 16

export function along(point: Vector, direction: Vector, distance: number): Vector {
  return { x: point.x + direction.x * distance, y: point.y + direction.y * distance }
}

export function isStraight(piece: ConnectorPiece): boolean {
  const { handleFrom: h0, handleTo: h1 } = piece
  return h0.x === 0 && h0.y === 0 && h1.x === 0 && h1.y === 0
}

export function straightPieces(points: Vector[]): ConnectorPiece[] {
  return points
    .slice(1)
    .map((to, index) => ({ from: points[index], to, handleFrom: ZERO, handleTo: ZERO }))
}

export function pieceLength(piece: ConnectorPiece): number {
  return Math.hypot(piece.to.x - piece.from.x, piece.to.y - piece.from.y)
}

function controls(piece: ConnectorPiece): [Vector, Vector] {
  const { from: a, to: b } = piece
  return [
    { x: a.x + piece.handleFrom.x, y: a.y + piece.handleFrom.y },
    { x: b.x + piece.handleTo.x, y: b.y + piece.handleTo.y }
  ]
}

/** The point at `t` along a piece; a straight run is parametrised by length. */
export function pointAt(piece: ConnectorPiece, t: number): Vector {
  const { from: a, to: b } = piece
  if (isStraight(piece)) return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  const [c1, c2] = controls(piece)
  const u = 1 - t
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y
  }
}

function derivativeAt(piece: ConnectorPiece, t: number): Vector {
  const { from: a, to: b } = piece
  const [c1, c2] = controls(piece)
  const u = 1 - t
  return {
    x: 3 * u * u * (c1.x - a.x) + 6 * u * t * (c2.x - c1.x) + 3 * t * t * (b.x - c2.x),
    y: 3 * u * u * (c1.y - a.y) + 6 * u * t * (c2.y - c1.y) + 3 * t * t * (b.y - c2.y)
  }
}

/** The part of a piece from `t0` to `t1`, its handles as de Casteljau splits them. */
export function subPiece(piece: ConnectorPiece, t0: number, t1: number): ConnectorPiece {
  const from = pointAt(piece, t0)
  const to = pointAt(piece, t1)
  if (isStraight(piece)) return { from, to, handleFrom: ZERO, handleTo: ZERO }
  const span = (t1 - t0) / 3
  const d0 = derivativeAt(piece, t0)
  const d1 = derivativeAt(piece, t1)
  return {
    from,
    to,
    handleFrom: { x: d0.x * span, y: d0.y * span },
    handleTo: { x: -d1.x * span, y: -d1.y * span }
  }
}

/** Where the ray from `from`, inside `box`, towards `toward` leaves it. */
export function exitPoint(box: Rect, from: Vector, toward: Vector): Vector {
  const dx = toward.x - from.x
  const dy = toward.y - from.y
  const tx = dx === 0 ? Infinity : ((dx > 0 ? box.x + box.width : box.x) - from.x) / dx
  const ty = dy === 0 ? Infinity : ((dy > 0 ? box.y + box.height : box.y) - from.y) / dy
  const t = Math.max(0, Math.min(tx, ty, 1))
  return { x: from.x + dx * t, y: from.y + dy * t }
}

/** The box a route's pieces cover, curves sampled along their length. */
export function piecesBounds(pieces: ConnectorPiece[]): Rect {
  const points: Rect[] = []
  for (const piece of pieces) {
    const samples = isStraight(piece) ? 1 : CURVE_BOUND_SAMPLES
    for (let step = 0; step <= samples; step++) {
      points.push({ ...pointAt(piece, step / samples), width: 0, height: 0 })
    }
  }
  return computeBounds(points)
}

/**
 * A route as a vector network: pieces that meet share a vertex, so elbows round their corners,
 * and a cut leaves two runs. The first and last vertices carry the connector's caps, as Figma
 * stores them.
 */
export function connectorNetwork(
  pieces: ConnectorPiece[],
  origin: Vector,
  caps: { start: StrokeCap; end: StrokeCap }
): VectorNetwork {
  const network: VectorNetwork = { vertices: [], segments: [], regions: [] }
  const vertexAt = (point: Vector) => {
    const last = network.vertices.at(-1)
    const x = point.x - origin.x
    const y = point.y - origin.y
    if (last && Math.abs(last.x - x) < EPSILON && Math.abs(last.y - y) < EPSILON) {
      return network.vertices.length - 1
    }
    network.vertices.push({ x, y })
    return network.vertices.length - 1
  }
  for (const piece of pieces) {
    const start = vertexAt(piece.from)
    const end = vertexAt(piece.to)
    if (start === end) continue
    network.segments.push({
      start,
      end,
      tangentStart: { ...piece.handleFrom },
      tangentEnd: { ...piece.handleTo }
    })
  }
  const first = network.vertices.at(0)
  const last = network.vertices.at(-1)
  if (first && last && first !== last) {
    first.strokeCap = caps.start
    last.strokeCap = caps.end
  }
  return network
}
