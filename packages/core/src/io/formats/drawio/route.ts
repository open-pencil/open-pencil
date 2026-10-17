import type { Vector } from '@open-pencil/scene-graph'

import type { DrawioCell } from './document'
import { styleNumber } from './style'

export type Point = Vector

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

type Side = 'left' | 'right' | 'top' | 'bottom'

function center(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** The side of `box` that faces `toward`, by whichever distance is larger. */
function facingSide(box: Box, toward: Point): Side {
  const c = center(box)
  const dx = (toward.x - c.x) / Math.max(box.width, 1)
  const dy = (toward.y - c.y) / Math.max(box.height, 1)
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}

function sidePoint(box: Box, side: Side): Point {
  const c = center(box)
  if (side === 'left') return { x: box.x, y: c.y }
  if (side === 'right') return { x: box.x + box.width, y: c.y }
  if (side === 'top') return { x: c.x, y: box.y }
  return { x: c.x, y: box.y + box.height }
}

/** The side a fixed connection point sits on, when it sits on one. */
function constraintSide(fx: number, fy: number): Side | null {
  if (fx === 0) return 'left'
  if (fx === 1) return 'right'
  if (fy === 0) return 'top'
  if (fy === 1) return 'bottom'
  return null
}

interface End {
  point: Point
  side: Side
}

function endpoint(cell: DrawioCell, box: Box, prefix: 'exit' | 'entry', toward: Point): End {
  const fx = Number.parseFloat(cell.style[`${prefix}X`] ?? '')
  const fy = Number.parseFloat(cell.style[`${prefix}Y`] ?? '')
  if (Number.isFinite(fx) && Number.isFinite(fy)) {
    const dx = styleNumber(cell.style, `${prefix}Dx`, 0)
    const dy = styleNumber(cell.style, `${prefix}Dy`, 0)
    return {
      point: { x: box.x + box.width * fx + dx, y: box.y + box.height * fy + dy },
      side: constraintSide(fx, fy) ?? facingSide(box, toward)
    }
  }
  const side = facingSide(box, toward)
  return { point: sidePoint(box, side), side }
}

function isHorizontal(side: Side): boolean {
  return side === 'left' || side === 'right'
}

/** Joins two ends with right angles, bending once or twice at the middle between them. */
function elbow(from: End, to: End): Point[] {
  const a = from.point
  const b = to.point
  if (a.x === b.x || a.y === b.y) return [a, b]
  if (isHorizontal(from.side) === isHorizontal(to.side)) {
    if (isHorizontal(from.side)) {
      const mid = (a.x + b.x) / 2
      return [a, { x: mid, y: a.y }, { x: mid, y: b.y }, b]
    }
    const mid = (a.y + b.y) / 2
    return [a, { x: a.x, y: mid }, { x: b.x, y: mid }, b]
  }
  return isHorizontal(from.side) ? [a, { x: b.x, y: a.y }, b] : [a, { x: a.x, y: b.y }, b]
}

/** Adds the corner each diagonal step between waypoints needs, leaving each point the way it was. */
function squareOff(points: Point[], firstHorizontal: boolean): Point[] {
  const result: Point[] = points.slice(0, 1)
  let horizontal = firstHorizontal
  for (const next of points.slice(1)) {
    const last = result.at(-1) ?? next
    if (last.x !== next.x && last.y !== next.y) {
      result.push(horizontal ? { x: next.x, y: last.y } : { x: last.x, y: next.y })
    }
    const corner = result.at(-1) ?? next
    horizontal = corner.y === next.y && corner.x !== next.x
    result.push(next)
  }
  return result
}

function simplify(points: Point[]): Point[] {
  const result: Point[] = []
  for (const point of points) {
    const last = result.at(-1)
    if (last && last.x === point.x && last.y === point.y) continue
    const before = result.at(-2)
    if (
      last &&
      before &&
      ((before.x === last.x && last.x === point.x) || (before.y === last.y && last.y === point.y))
    ) {
      result[result.length - 1] = point
      continue
    }
    result.push(point)
  }
  return result
}

interface LooseEnds {
  start: Point | null
  end: Point | null
}

/** The edge's own start and end points on the page, for ends not attached to a shape. */
function looseEnds(cell: DrawioCell, origin: Point): LooseEnds {
  const place = (p: Point | null): Point | null =>
    p ? { x: p.x + origin.x, y: p.y + origin.y } : null
  return { start: place(cell.geometry.sourcePoint), end: place(cell.geometry.targetPoint) }
}

/** An edge with at least one end not attached to a shape: its shape ends, loose ends, waypoints. */
function partlyAttached(
  from: End | null,
  to: End | null,
  loose: LooseEnds,
  waypoints: Point[],
  orthogonal: boolean
): Point[] {
  const start = from?.point ?? loose.start
  const end = to?.point ?? loose.end
  const through = [...(start ? [start] : []), ...waypoints, ...(end ? [end] : [])]
  return simplify(orthogonal ? squareOff(through, from ? isHorizontal(from.side) : true) : through)
}

/**
 * The corner points of an edge on the page. draw.io routes edges at draw time and stores only
 * their waypoints, so an edge is placed once from its ends and waypoints, with right angles when
 * its style asks for them. An end not attached to a shape uses the edge's own source or target
 * point.
 */
export function routeEdge(
  cell: DrawioCell,
  source: Box | null,
  target: Box | null,
  origin: Point
): Point[] {
  const waypoints = cell.geometry.points.map((p) => ({ x: p.x + origin.x, y: p.y + origin.y }))
  const loose = looseEnds(cell, origin)
  const orthogonal = (cell.style.edgeStyle ?? '').startsWith('orthogonal')
  const firstAim = waypoints.at(0) ?? (target ? center(target) : loose.end)
  const lastAim = waypoints.at(-1) ?? (source ? center(source) : loose.start)
  const from: End | null = source && firstAim ? endpoint(cell, source, 'exit', firstAim) : null
  const to: End | null = target && lastAim ? endpoint(cell, target, 'entry', lastAim) : null
  if (!from || !to) return partlyAttached(from, to, loose, waypoints, orthogonal)
  if (waypoints.length > 0) {
    const through = [from.point, ...waypoints, to.point]
    return simplify(orthogonal ? squareOff(through, isHorizontal(from.side)) : through)
  }
  return simplify(orthogonal ? elbow(from, to) : [from.point, to.point])
}
