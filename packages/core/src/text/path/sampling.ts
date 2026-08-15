import type { TextPathData } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

// --- Arc-length sampled path ---

const SAMPLES_PER_SEGMENT = 256

export interface SampledPath {
  xs: Float64Array
  ys: Float64Array
  /** Cumulative arc length per sample; cum[n-1] is the total length. */
  cum: Float64Array
  length: number
  closed: boolean
}

/** Sample the path's cubic segments into node-local space inside `box`. */
export function sampleTextPath(data: TextPathData, box: Rect): SampledPath | null {
  const sx = box.width / data.normalizedSize.x
  const sy = box.height / data.normalizedSize.y
  const segs = data.network.segments
  const verts = data.network.vertices
  const n = segs.length * SAMPLES_PER_SEGMENT + 1
  const xs = new Float64Array(n)
  const ys = new Float64Array(n)
  let w = 0
  for (let si = 0; si < segs.length; si++) {
    const seg = segs[si]
    // .at() types as possibly-undefined: malformed imports can hold stale indices.
    const a = verts.at(seg.start)
    const b = verts.at(seg.end)
    if (!a || !b) return null
    const c1x = a.x + seg.tangentStart.x
    const c1y = a.y + seg.tangentStart.y
    const c2x = b.x + seg.tangentEnd.x
    const c2y = b.y + seg.tangentEnd.y
    const last = si === segs.length - 1
    const count = last ? SAMPLES_PER_SEGMENT + 1 : SAMPLES_PER_SEGMENT
    for (let i = 0; i < count; i++) {
      const t = i / SAMPLES_PER_SEGMENT
      const mt = 1 - t
      const nx = mt * mt * mt * a.x + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * b.x
      const ny = mt * mt * mt * a.y + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * b.y
      xs[w] = box.x + nx * sx
      ys[w] = box.y + ny * sy
      w++
    }
  }
  const cum = new Float64Array(n)
  for (let i = 1; i < n; i++) {
    cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1])
  }
  const length = cum[n - 1]
  if (!(length > 0)) return null
  const closed = Math.hypot(xs[n - 1] - xs[0], ys[n - 1] - ys[0]) < length / n + 1e-6
  return { xs, ys, cum, length, closed }
}

export interface PathPoint {
  x: number
  y: number
  /** Unit tangent along increasing arc length. */
  tx: number
  ty: number
  s: number
}

/**
 * Node-local point (+ unit tangent along increasing arc length) at absolute
 * arc length `sIn`. Shared by layout and the selection overlay's start marker
 * (pass `fraction * path.length`). Callers already holding a sampled path use
 * this directly rather than re-sampling.
 */
export function pointAtArc(path: SampledPath, sIn: number): PathPoint {
  let s = sIn
  if (path.closed) {
    s = ((s % path.length) + path.length) % path.length
  } else {
    s = Math.min(Math.max(s, 0), path.length)
  }
  // Binary search for the sample interval containing s.
  let lo = 0
  let hi = path.cum.length - 1
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (path.cum[mid] <= s) lo = mid
    else hi = mid
  }
  const span = path.cum[hi] - path.cum[lo]
  const f = span > 0 ? (s - path.cum[lo]) / span : 0
  const x = path.xs[lo] + (path.xs[hi] - path.xs[lo]) * f
  const y = path.ys[lo] + (path.ys[hi] - path.ys[lo]) * f
  // Tangent from a slightly wider window for stability.
  const a = Math.max(0, lo - 1)
  const b = Math.min(path.cum.length - 1, hi + 1)
  let tx = path.xs[b] - path.xs[a]
  let ty = path.ys[b] - path.ys[a]
  const m = Math.hypot(tx, ty) || 1
  tx /= m
  ty /= m
  return { x, y, tx, ty, s }
}

export function nearestArcPoint(path: SampledPath, px: number, py: number): PathPoint {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < path.xs.length; i++) {
    const dx = path.xs[i] - px
    const dy = path.ys[i] - py
    const d = dx * dx + dy * dy
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  const p = pointAtArc(path, path.cum[best])
  // Refine along the tangent so s has sub-sample accuracy.
  const along = (px - p.x) * p.tx + (py - p.y) * p.ty
  return pointAtArc(path, p.s + along)
}
