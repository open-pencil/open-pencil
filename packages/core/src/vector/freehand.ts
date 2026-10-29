import type { VectorNetwork, VectorSegment, VectorVertex } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

const ZERO: Vector = { x: 0, y: 0 }

function distanceToLine(point: Vector, a: Vector, b: Vector): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return Math.hypot(point.x - a.x, point.y - a.y)
  return Math.abs((point.x - a.x) * dy - (point.y - a.y) * dx) / length
}

/** Indexes Douglas–Peucker keeps between `first` and `last`, both kept by the caller. */
function keepFarthest(
  points: readonly Vector[],
  first: number,
  last: number,
  tolerance: number,
  kept: number[]
) {
  let farthest = -1
  let distance = tolerance
  for (let i = first + 1; i < last; i++) {
    const d = distanceToLine(points[i], points[first], points[last])
    if (d > distance) {
      distance = d
      farthest = i
    }
  }
  if (farthest < 0) return
  keepFarthest(points, first, farthest, tolerance, kept)
  kept.push(farthest)
  keepFarthest(points, farthest, last, tolerance, kept)
}

/**
 * The points of a freehand stroke a pencil curve is built on: the first and last, the first
 * sample after the press, which sets the direction the stroke leaves in, and the points that
 * stray more than `tolerance` from the line through their neighbours. A stroke that never strays
 * from the line between its ends keeps only the ends. Pass a tolerance in the stroke's units, so
 * screen pixels divided by zoom for a stroke in canvas coordinates. A stroke that ends where it
 * started has no direction to leave in, so `closed` skips the first sample.
 */
export function simplifyFreehand(
  points: readonly Vector[],
  tolerance: number,
  closed = false
): Vector[] {
  const distinct = points.filter(
    (point, i) => i === 0 || point.x !== points[i - 1].x || point.y !== points[i - 1].y
  )
  if (distinct.length <= 2) return distinct.map((point) => ({ ...point }))

  const first = distinct[0]
  const last = distinct[distinct.length - 1]
  if (distinct.every((point) => distanceToLine(point, first, last) <= tolerance)) {
    return [{ ...first }, { ...last }]
  }

  const kept = closed ? [0] : [0, 1]
  keepFarthest(distinct, kept.length - 1, distinct.length - 1, tolerance, kept)
  kept.push(distinct.length - 1)
  return kept.map((i) => ({ ...distinct[i] }))
}

function lerp(a: Vector, b: Vector, scale: number): Vector {
  return { x: (b.x - a.x) * scale, y: (b.y - a.y) * scale }
}

/** A closed stroke's loop: every control is a knot with neighbours on both sides. */
function closedNetwork(controls: readonly Vector[]): VectorNetwork {
  // The last control is the release, next to the press, so the loop goes round the others.
  const q = controls.slice(0, -1)
  const m = q.length
  const at = (i: number) => q[(i + m) % m]
  const vertices: VectorVertex[] = q.map((point, i) => ({
    x: (at(i - 1).x + 4 * point.x + at(i + 1).x) / 6,
    y: (at(i - 1).y + 4 * point.y + at(i + 1).y) / 6,
    handleMirroring: 'ANGLE'
  }))
  const segments: VectorSegment[] = q.map((_, i) => ({
    start: i,
    end: (i + 1) % m,
    tangentStart: lerp(at(i - 1), at(i + 1), 1 / 6),
    tangentEnd: lerp(at(i + 2), at(i), 1 / 6)
  }))
  return { vertices, segments, regions: [] }
}

/**
 * A pencil stroke as a vector network, as Figma's pencil builds it: `controls` are the control
 * polygon of a uniform cubic B-spline whose ends are pinned to the first and last control, and
 * each knot becomes a smooth vertex, so corners in the polygon come out rounded. A `closed`
 * stroke, whose last control lands back on its first, wraps round as one smooth loop with no
 * region, so it stays an outline.
 */
export function freehandNetwork(controls: readonly Vector[], closed = false): VectorNetwork {
  if (closed && controls.length > 3) return closedNetwork(controls)
  const q = [...controls]
  const n = q.length - 1
  if (n < 1) return { vertices: q.map((point) => ({ ...point })), segments: [], regions: [] }

  const vertices: VectorVertex[] = q.map((point, i) => {
    if (i === 0 || i === n) return { x: point.x, y: point.y, handleMirroring: 'ANGLE' }
    return {
      x: (q[i - 1].x + 4 * point.x + q[i + 1].x) / 6,
      y: (q[i - 1].y + 4 * point.y + q[i + 1].y) / 6,
      handleMirroring: 'ANGLE'
    }
  })

  const segments: VectorSegment[] = []
  if (n === 1) {
    segments.push({ start: 0, end: 1, tangentStart: { ...ZERO }, tangentEnd: { ...ZERO } })
  } else {
    for (let i = 0; i < n; i++) {
      segments.push({
        start: i,
        end: i + 1,
        tangentStart: i === 0 ? lerp(q[0], q[1], 1 / 3) : lerp(q[i - 1], q[i + 1], 1 / 6),
        tangentEnd: i + 1 === n ? lerp(q[n], q[n - 1], 1 / 3) : lerp(q[i + 2], q[i], 1 / 6)
      })
    }
  }

  return { vertices, segments, regions: [] }
}
