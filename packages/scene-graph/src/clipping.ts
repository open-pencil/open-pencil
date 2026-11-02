import { computeBounds, type VisualBounds } from './geometry'
import type { Vector } from './primitives'

/**
 * Rotated-rectangle clipping: a polygon or an axis-aligned box cut by a convex polygon, such as
 * the canvas corners of a rotated frame that clips its content.
 */

function crossProduct(a: Vector, b: Vector, p: Vector): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
}

function lineSegmentIntersect(p1: Vector, p2: Vector, p3: Vector, p4: Vector): Vector {
  const dx1 = p2.x - p1.x
  const dy1 = p2.y - p1.y
  const dx2 = p4.x - p3.x
  const dy2 = p4.y - p3.y
  const denom = dx1 * dy2 - dy1 * dx2
  if (denom === 0) return p1
  const t = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / denom
  return { x: p1.x + t * dx1, y: p1.y + t * dy1 }
}

function clipHalfPlane(polygon: Vector[], a: Vector, b: Vector, wantPositive: boolean): Vector[] {
  const output: Vector[] = []
  const isInside = (p: Vector): boolean => {
    const cross = crossProduct(a, b, p)
    return wantPositive ? cross >= 0 : cross <= 0
  }
  for (let i = 0; i < polygon.length; i++) {
    const curr = polygon[i]
    const prev = polygon[i === 0 ? polygon.length - 1 : i - 1]
    const currInside = isInside(curr)
    const prevInside = isInside(prev)
    if (currInside) {
      if (!prevInside) output.push(lineSegmentIntersect(prev, curr, a, b))
      output.push(curr)
    } else if (prevInside) {
      output.push(lineSegmentIntersect(prev, curr, a, b))
    }
  }
  return output
}

/**
 * Clip a subject polygon against a convex polygon (e.g. the 4 canvas-space
 * corners of a rotated clipping ancestor).
 *
 * Uses Sutherland–Hodgman polygon clipping with centroid-based interior
 * detection, making it robust to either winding order of the clip polygon.
 * Returns the clipped polygon, or null if the subject is fully outside the
 * clip polygon. When `clipCorners` has fewer than 3 points the subject is
 * returned unchanged (no clipping).
 *
 * Preserving the polygon (rather than collapsing to an AABB) lets callers
 * chain multiple clips without reintroducing corners removed by an inner clip.
 */
export function clipPolygon(subject: Vector[], clipCorners: Vector[]): Vector[] | null {
  if (clipCorners.length < 3) return subject

  let cx = 0
  let cy = 0
  for (const c of clipCorners) {
    cx += c.x
    cy += c.y
  }
  cx /= clipCorners.length
  cy /= clipCorners.length

  let polygon: Vector[] = subject

  for (let i = 0; i < clipCorners.length; i++) {
    if (polygon.length === 0) return null
    const a = clipCorners[i]
    const b = clipCorners[(i + 1) % clipCorners.length]
    const centroidCross = crossProduct(a, b, { x: cx, y: cy })
    polygon = clipHalfPlane(polygon, a, b, centroidCross >= 0)
  }

  return polygon.length === 0 ? null : polygon
}

/**
 * Clip an axis-aligned VisualBounds rectangle against a convex polygon
 * (e.g. the 4 canvas-space corners of a rotated clipping ancestor).
 *
 * Returns the AABB of the intersection, or null if the bounds are fully
 * outside the clip polygon. Delegates to {@link clipPolygon}.
 *
 * For a non-rotated clip (axis-aligned corners) the result is identical
 * to `intersectVisualBounds`.
 */
export function clipBoundsToPolygon(
  bounds: VisualBounds,
  clipCorners: Vector[]
): VisualBounds | null {
  if (clipCorners.length < 3) return bounds

  const subject: Vector[] = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY }
  ]

  const polygon = clipPolygon(subject, clipCorners)
  if (!polygon) return null

  const box = computeBounds(polygon.map(({ x, y }) => ({ x, y, width: 0, height: 0 })))
  if (box.width <= 0 || box.height <= 0) return null
  return { minX: box.x, minY: box.y, maxX: box.x + box.width, maxY: box.y + box.height }
}
