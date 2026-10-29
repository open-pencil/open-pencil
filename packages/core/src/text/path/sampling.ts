import { clamp } from 'es-toolkit'

import type { TextPathData } from '@open-pencil/scene-graph'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

interface Cubic {
  p0: Vector
  p1: Vector
  p2: Vector
  p3: Vector
}

/**
 * The layout path flattened once into points about half a pixel apart. Each point keeps the curve
 * and parameter it came from, so a lookup between two points evaluates the curve itself.
 */
export interface SampledPath {
  curves: Cubic[]
  xs: Float64Array
  ys: Float64Array
  /** Arc lengths corresponding to the sampled points. */
  cum: Float64Array
  curveIndex: Uint32Array
  ts: Float64Array
  length: number
  closed: boolean
}

export interface PathPoint {
  x: number
  y: number
  /** Unit tangent along increasing arc length. */
  tx: number
  ty: number
  s: number
}

const MIN_SAMPLES = 64
const MAX_SAMPLES = 2048
const MIN_CURVE_STEPS = 4

/** The network's segments as cubics mapped into `box`, in segment order. */
function pathCurves(data: TextPathData, box: Rect): Cubic[] | null {
  if (!(data.normalizedSize.x > 0) || !(data.normalizedSize.y > 0)) return null
  const sx = box.width / data.normalizedSize.x
  const sy = box.height / data.normalizedSize.y
  const at = (x: number, y: number): Vector => ({ x: box.x + x * sx, y: box.y + y * sy })
  const curves: Cubic[] = []
  for (const segment of data.network.segments) {
    const start = data.network.vertices.at(segment.start)
    const end = data.network.vertices.at(segment.end)
    if (!start || !end) return null
    curves.push({
      p0: at(start.x, start.y),
      p1: at(start.x + segment.tangentStart.x, start.y + segment.tangentStart.y),
      p2: at(end.x + segment.tangentEnd.x, end.y + segment.tangentEnd.y),
      p3: at(end.x, end.y)
    })
  }
  return curves.length > 0 ? curves : null
}

function cubicPoint({ p0, p1, p2, p3 }: Cubic, t: number): Vector {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y
  }
}

function cubicDerivative({ p0, p1, p2, p3 }: Cubic, t: number): Vector {
  const u = 1 - t
  const a = 3 * u * u
  const b = 6 * u * t
  const c = 3 * t * t
  return {
    x: a * (p1.x - p0.x) + b * (p2.x - p1.x) + c * (p3.x - p2.x),
    y: a * (p1.y - p0.y) + b * (p2.y - p1.y) + c * (p3.y - p2.y)
  }
}

/** Length of the control polygon: an upper bound on the curve's length, for spacing samples. */
function hullLength({ p0, p1, p2, p3 }: Cubic): number {
  return (
    Math.hypot(p1.x - p0.x, p1.y - p0.y) +
    Math.hypot(p2.x - p1.x, p2.y - p1.y) +
    Math.hypot(p3.x - p2.x, p3.y - p2.y)
  )
}

/** Flatten the vector network mapped into `box` for arc-length lookups. */
export function sampleTextPath(data: TextPathData, box: Rect): SampledPath | null {
  const curves = pathCurves(data, box)
  if (!curves) return null
  const hulls = curves.map(hullLength)
  const hull = hulls.reduce((sum, value) => sum + value, 0)
  if (!(hull > 0) || !Number.isFinite(hull)) return null
  const target = clamp(Math.ceil(hull * 2), MIN_SAMPLES, MAX_SAMPLES)
  const steps = hulls.map((value) => Math.max(MIN_CURVE_STEPS, Math.round((target * value) / hull)))
  const count = steps.reduce((sum, value) => sum + value + 1, 0)
  const xs = new Float64Array(count)
  const ys = new Float64Array(count)
  const cum = new Float64Array(count)
  const curveIndex = new Uint32Array(count)
  const ts = new Float64Array(count)

  let index = 0
  let length = 0
  for (const [curve, cubic] of curves.entries()) {
    for (let step = 0; step <= steps[curve]; step++) {
      const t = step / steps[curve]
      const point = cubicPoint(cubic, t)
      // A segment that does not start where the last one ended jumps there without adding length.
      if (step > 0) length += Math.hypot(point.x - xs[index - 1], point.y - ys[index - 1])
      xs[index] = point.x
      ys[index] = point.y
      cum[index] = length
      curveIndex[index] = curve
      ts[index] = t
      index++
    }
  }
  if (!(length > 0)) return null
  const closed = Math.hypot(xs[count - 1] - xs[0], ys[count - 1] - ys[0]) < length / 1024 + 1e-6
  return { curves, xs, ys, cum, curveIndex, ts, length, closed }
}

/** Node-local point and unit tangent at absolute arc length `sIn`. */
export function pointAtArc(path: SampledPath, sIn: number): PathPoint {
  let s = sIn
  if (path.closed) s = ((s % path.length) + path.length) % path.length
  else s = Math.min(Math.max(s, 0), path.length)

  const { cum, curveIndex, ts } = path
  let lo = 0
  let hi = cum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid] < s) lo = mid
    else hi = mid
  }
  const span = cum[hi] - cum[lo]
  const sameCurve = curveIndex[lo] === curveIndex[hi]
  const curve = path.curves[sameCurve ? curveIndex[lo] : curveIndex[hi]]
  const t = sameCurve && span > 0 ? ts[lo] + ((ts[hi] - ts[lo]) * (s - cum[lo])) / span : ts[hi]
  const point = cubicPoint(curve, t)

  // A straight segment with no handles has no derivative at its ends; take the samples' direction.
  let { x: dx, y: dy } = cubicDerivative(curve, t)
  if (Math.hypot(dx, dy) < 1e-9) {
    dx = path.xs[hi] - path.xs[lo]
    dy = path.ys[hi] - path.ys[lo]
  }
  if (Math.hypot(dx, dy) < 1e-9) {
    dx = curve.p3.x - curve.p0.x
    dy = curve.p3.y - curve.p0.y
  }
  const norm = Math.hypot(dx, dy) || 1
  return { x: point.x, y: point.y, tx: dx / norm, ty: dy / norm, s }
}

/** Closest sampled/refined path point, used to calibrate imported glyph baselines. */
export function nearestArcPoint(path: SampledPath, px: number, py: number): PathPoint {
  let best = 0
  let bestD = Infinity
  for (let index = 0; index < path.xs.length; index++) {
    const d = (path.xs[index] - px) ** 2 + (path.ys[index] - py) ** 2
    if (d < bestD) {
      bestD = d
      best = index
    }
  }
  const point = pointAtArc(path, path.cum[best])
  const along = (px - point.x) * point.tx + (py - point.y) * point.ty
  return pointAtArc(path, point.s + along)
}

/**
 * How far along the sampled path the text starts: on the segment Figma marks as the start, at
 * `tValue` along it as a curve parameter. Null when the start segment is missing.
 */
export function textPathStartDistance(data: TextPathData, path: SampledPath): number | null {
  const startSegment = data.startSegment ?? 0
  if (startSegment < 0 || startSegment >= path.curves.length) return null
  const t = clamp(data.tValue, 0, 1)
  const { cum, curveIndex, ts } = path
  for (let index = 1; index < cum.length; index++) {
    if (curveIndex[index] !== startSegment || ts[index] < t) continue
    // Each curve's samples run from t = 0 to 1; its first one starts where the curve before ended.
    const span = ts[index] - ts[index - 1]
    const f = span > 0 ? (t - ts[index - 1]) / span : 0
    return cum[index - 1] + (cum[index] - cum[index - 1]) * f
  }
  return null
}

/**
 * How far along `path` the text path start sits: the marked start segment when the import read
 * one, else `tValue` as a fraction of the whole path.
 */
export function textPathStartArc(data: TextPathData, path: SampledPath): number {
  const start = data.startSegment === undefined ? null : textPathStartDistance(data, path)
  return clamp(start ?? data.tValue * path.length, 0, path.length)
}
