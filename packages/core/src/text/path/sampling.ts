import { svgPathProperties } from 'svg-path-properties'

import type { TextPathData } from '@open-pencil/scene-graph'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

type PathProperties = InstanceType<typeof svgPathProperties>

export interface SampledPath {
  properties: PathProperties
  xs: Float64Array
  ys: Float64Array
  /** Arc lengths corresponding to the sampled points. */
  cum: Float64Array
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

function svgPath(data: TextPathData, box: Rect): string | null {
  if (!(data.normalizedSize.x > 0) || !(data.normalizedSize.y > 0)) return null
  const sx = box.width / data.normalizedSize.x
  const sy = box.height / data.normalizedSize.y
  const commands: string[] = []
  let previousEnd: number | null = null

  for (const segment of data.network.segments) {
    const start = data.network.vertices.at(segment.start)
    const end = data.network.vertices.at(segment.end)
    if (!start || !end) return null
    const startX = box.x + start.x * sx
    const startY = box.y + start.y * sy
    if (previousEnd !== segment.start) commands.push(`M${startX} ${startY}`)
    commands.push(
      `C${box.x + (start.x + segment.tangentStart.x) * sx} ${box.y + (start.y + segment.tangentStart.y) * sy} ` +
        `${box.x + (end.x + segment.tangentEnd.x) * sx} ${box.y + (end.y + segment.tangentEnd.y) * sy} ` +
        `${box.x + end.x * sx} ${box.y + end.y * sy}`
    )
    previousEnd = segment.end
  }

  return commands.length > 0 ? commands.join(' ') : null
}

/** Build headless SVG path metrics for the vector network mapped into `box`. */
export function sampleTextPath(data: TextPathData, box: Rect): SampledPath | null {
  const source = svgPath(data, box)
  if (!source) return null
  const properties = new svgPathProperties(source)
  const length = properties.getTotalLength()
  if (!(length > 0) || !Number.isFinite(length)) return null
  const start = properties.getPointAtLength(0)
  const end = properties.getPointAtLength(length)
  const closed = Math.hypot(end.x - start.x, end.y - start.y) < length / 1024 + 1e-6
  const sampleCount = Math.max(64, Math.min(2048, Math.ceil(length * 2)))
  const xs = new Float64Array(sampleCount + 1)
  const ys = new Float64Array(sampleCount + 1)
  const cum = new Float64Array(sampleCount + 1)
  for (let index = 0; index <= sampleCount; index++) {
    const distance = (length * index) / sampleCount
    const point = properties.getPointAtLength(distance)
    xs[index] = point.x
    ys[index] = point.y
    cum[index] = distance
  }
  return { properties, xs, ys, cum, length, closed }
}

/** Node-local point and unit tangent at absolute arc length `sIn`. */
export function pointAtArc(path: SampledPath, sIn: number): PathPoint {
  let s = sIn
  if (path.closed) s = ((s % path.length) + path.length) % path.length
  else s = Math.min(Math.max(s, 0), path.length)
  const point = path.properties.getPropertiesAtLength(s)
  return { x: point.x, y: point.y, tx: point.tangentX, ty: point.tangentY, s }
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

const lerp = (a: Vector, b: Vector, t: number): Vector => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t
})

function cubicLength(p0: Vector, p1: Vector, p2: Vector, p3: Vector): number {
  const source = `M${p0.x} ${p0.y} C${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`
  return new svgPathProperties(source).getTotalLength()
}

/**
 * How far along the sampled path, scaled into `box`, the text starts: on the segment Figma marks
 * as the start, at `tValue` along it as a curve parameter. Null when the start segment is missing.
 */
export function textPathStartDistance(data: TextPathData, box: Rect): number | null {
  if (!(data.normalizedSize.x > 0) || !(data.normalizedSize.y > 0)) return null
  const sx = box.width / data.normalizedSize.x
  const sy = box.height / data.normalizedSize.y
  const { segments, vertices } = data.network
  const startSegment = data.startSegment ?? 0
  if (startSegment < 0 || startSegment >= segments.length) return null
  const t = Math.min(Math.max(data.tValue, 0), 1)

  let distance = 0
  for (const [index, segment] of segments.entries()) {
    const start = vertices.at(segment.start)
    const end = vertices.at(segment.end)
    if (!start || !end) return null
    const p0 = { x: box.x + start.x * sx, y: box.y + start.y * sy }
    const p1 = {
      x: box.x + (start.x + segment.tangentStart.x) * sx,
      y: box.y + (start.y + segment.tangentStart.y) * sy
    }
    const p2 = {
      x: box.x + (end.x + segment.tangentEnd.x) * sx,
      y: box.y + (end.y + segment.tangentEnd.y) * sy
    }
    const p3 = { x: box.x + end.x * sx, y: box.y + end.y * sy }
    if (index < startSegment) {
      distance += cubicLength(p0, p1, p2, p3)
      continue
    }
    // The part of the start segment before `t`, by de Casteljau.
    const a = lerp(p0, p1, t)
    const b = lerp(p1, p2, t)
    const ab = lerp(a, b, t)
    const bc = lerp(b, lerp(p2, p3, t), t)
    return distance + cubicLength(p0, a, ab, lerp(ab, bc, t))
  }
  return null
}
