import type { Vector } from '../primitives'
import type { WindingRule } from '../types'

/**
 * The signed number of times closed contours wind around `point`, each closing back to its start
 * as a path fill closes it.
 */
export function windingNumber(contours: Iterable<Vector[]>, point: Vector): number {
  let winding = 0
  for (const contour of contours) {
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i]
      const b = contour[(i + 1) % contour.length]
      // Which side of the edge a→b the point is on, positive when left.
      const side = (b.x - a.x) * (point.y - a.y) - (point.x - a.x) * (b.y - a.y)
      if (a.y <= point.y) {
        if (b.y > point.y && side > 0) winding++
      } else if (b.y <= point.y && side < 0) {
        winding--
      }
    }
  }
  return winding
}

/** Whether contours filled by `windingRule` cover the point. */
export function containsByWinding(
  contours: Iterable<Vector[]>,
  windingRule: WindingRule,
  point: Vector
): boolean {
  const winding = windingNumber(contours, point)
  return windingRule === 'EVENODD' ? winding % 2 !== 0 : winding !== 0
}

export function distanceToSegment(p: Vector, a: Vector, b: Vector): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** The distance from the point to the nearest of the polylines. */
export function distanceToLines(lines: readonly Vector[][], point: Vector): number {
  let nearest = Infinity
  for (const line of lines) {
    if (line.length === 1) {
      nearest = Math.min(nearest, Math.hypot(point.x - line[0].x, point.y - line[0].y))
    }
    for (let i = 0; i + 1 < line.length; i++) {
      nearest = Math.min(nearest, distanceToSegment(point, line[i], line[i + 1]))
    }
  }
  return nearest
}
