import type { Vector } from './primitives'
import type { Stroke, StrokeCap, VectorNetwork } from './types'

export type ArrowCapKind =
  | 'ARROW_LINES'
  | 'ARROW_EQUILATERAL'
  | 'TRIANGLE_FILLED'
  | 'DIAMOND_FILLED'
  | 'CIRCLE_FILLED'

export interface ArrowEndpoint {
  x: number
  y: number
  /** Direction the arrow points, in radians, away from the path. */
  angle: number
  cap: ArrowCapKind
}

export interface ArrowWing {
  from: Vector
  to: Vector
}

/**
 * Arrow heads relative to stroke weight, from the stroke outlines Figma gives for them. The
 * triangle heads run 5 back from the end and spread to 5/√3 on either side: the equilateral
 * arrow comes to its point at the end, and the filled triangle has its base across it. The
 * diamond reaches 5/√3 from the end every way, and the circle has radius 8/3. A line arrow's
 * wings meet at the end and run 4.5 back at 45°, stroked at the line's weight with round ends.
 */
const TRIANGLE_HEAD_DEPTH = 5
const TRIANGLE_HEAD_HALF_WIDTH = 5 / Math.sqrt(3)
const CIRCLE_HEAD_RADIUS = 8 / 3
const WING_LENGTH = 4.5
const WING_SWEEP = Math.PI / 4
/** How far a line stops short of its end under a triangle head: half a weight inside its base. */
const SHAFT_TRIM = TRIANGLE_HEAD_DEPTH - 0.5
/** The furthest any head reaches from its line, a line arrow's wing ends with their round caps. */
const HEAD_REACH = Math.max(
  WING_LENGTH * Math.sin(WING_SWEEP) + 0.5,
  TRIANGLE_HEAD_HALF_WIDTH,
  CIRCLE_HEAD_RADIUS
)

const ARROW_CAPS: ReadonlySet<string> = new Set<ArrowCapKind>([
  'ARROW_LINES',
  'ARROW_EQUILATERAL',
  'TRIANGLE_FILLED',
  'DIAMOND_FILLED',
  'CIRCLE_FILLED'
])

export function isArrowCap(cap: string | undefined): cap is ArrowCapKind {
  return cap !== undefined && ARROW_CAPS.has(cap)
}

/**
 * Worst-case reach of an arrow head past the path. Used to widen visual bounds and render
 * margins so heads are not cropped by caches, exports, or culling. Vertex-level caps in the
 * network count even when no stroke or node cap is an arrow.
 */
export function arrowCapOverflow(
  strokes?: Stroke[],
  fallbackCap?: StrokeCap,
  network?: VectorNetwork | null
): number {
  const networkHasArrow = network?.vertices.some((vertex) => isArrowCap(vertex.strokeCap)) ?? false
  let overflow = 0
  for (const stroke of strokes ?? []) {
    if (!stroke.visible) continue
    if (networkHasArrow || isArrowCap(stroke.cap ?? fallbackCap)) {
      overflow = Math.max(overflow, HEAD_REACH * stroke.weight)
    }
  }
  return overflow
}

/**
 * Finds the open path ends that should carry an arrow head: vertices used by
 * exactly one segment, with a per-vertex cap override falling back to the
 * stroke cap. The returned angle points away from the path, following the
 * terminal bezier tangent when the segment is curved.
 */
export function collectArrowEndpoints(
  network: VectorNetwork,
  fallbackCap: StrokeCap
): ArrowEndpoint[] {
  const degrees = Array.from({ length: network.vertices.length }, () => 0)
  for (const segment of network.segments) {
    degrees[segment.start]++
    degrees[segment.end]++
  }

  const endpoints: ArrowEndpoint[] = []
  for (const segment of network.segments) {
    for (const side of ['start', 'end'] as const) {
      const vertexIndex = segment[side]
      if (degrees[vertexIndex] !== 1) continue
      const vertex = network.vertices[vertexIndex]
      const cap = (vertex.strokeCap as StrokeCap | undefined) ?? fallbackCap
      if (!isArrowCap(cap)) continue

      const tangent = side === 'start' ? segment.tangentStart : segment.tangentEnd
      let controlX: number
      let controlY: number
      if (Math.abs(tangent.x) > 0.001 || Math.abs(tangent.y) > 0.001) {
        controlX = vertex.x + tangent.x
        controlY = vertex.y + tangent.y
      } else {
        const other = network.vertices[side === 'start' ? segment.end : segment.start]
        controlX = other.x
        controlY = other.y
      }
      const dx = vertex.x - controlX
      const dy = vertex.y - controlY
      if (dx === 0 && dy === 0) continue
      endpoints.push({ x: vertex.x, y: vertex.y, angle: Math.atan2(dy, dx), cap })
    }
  }
  return endpoints
}

/**
 * Points of a filled equilateral arrow head: tip first, then the two base corners. The tip sits
 * exactly on the endpoint and the head sweeps back along the path.
 */
export function equilateralArrowPoints(
  x: number,
  y: number,
  angle: number,
  weight: number
): [Vector, Vector, Vector] {
  const { dir, perp } = headAxes(angle)
  const half = TRIANGLE_HEAD_HALF_WIDTH * weight
  const baseX = x - TRIANGLE_HEAD_DEPTH * weight * dir.x
  const baseY = y - TRIANGLE_HEAD_DEPTH * weight * dir.y
  return [
    { x, y },
    { x: baseX - half * perp.x, y: baseY - half * perp.y },
    { x: baseX + half * perp.x, y: baseY + half * perp.y }
  ]
}

/** The two wings of an open (lines-style) arrow head, each from the tip to its end. */
export function arrowLinesSegments(
  x: number,
  y: number,
  angle: number,
  weight: number
): [ArrowWing, ArrowWing] {
  const wingLength = WING_LENGTH * weight
  const tip = { x, y }
  const makeWing = (wingAngle: number): ArrowWing => ({
    from: tip,
    to: { x: x + wingLength * Math.cos(wingAngle), y: y + wingLength * Math.sin(wingAngle) }
  })
  return [makeWing(angle + Math.PI - WING_SWEEP), makeWing(angle + Math.PI + WING_SWEEP)]
}

function headAxes(angle: number) {
  const dir = { x: Math.cos(angle), y: Math.sin(angle) }
  return { dir, perp: { x: -dir.y, y: dir.x } }
}

/**
 * Points of a filled triangle head: its base across the end, narrowing back along the path to
 * the shaft's width, in drawing order.
 */
export function triangleCapPoints(
  x: number,
  y: number,
  angle: number,
  weight: number
): [Vector, Vector, Vector, Vector] {
  const { dir, perp } = headAxes(angle)
  const back = {
    x: x - TRIANGLE_HEAD_DEPTH * weight * dir.x,
    y: y - TRIANGLE_HEAD_DEPTH * weight * dir.y
  }
  const at = (point: Vector, side: number) => ({
    x: point.x + side * perp.x,
    y: point.y + side * perp.y
  })
  const half = TRIANGLE_HEAD_HALF_WIDTH * weight
  return [at(back, weight / 2), at({ x, y }, half), at({ x, y }, -half), at(back, -weight / 2)]
}

/** Points of a filled diamond head centred on the end, in drawing order. */
export function diamondCapPoints(
  x: number,
  y: number,
  angle: number,
  weight: number
): [Vector, Vector, Vector, Vector] {
  const { dir, perp } = headAxes(angle)
  const reach = TRIANGLE_HEAD_HALF_WIDTH * weight
  return [
    { x: x + reach * dir.x, y: y + reach * dir.y },
    { x: x + reach * perp.x, y: y + reach * perp.y },
    { x: x - reach * dir.x, y: y - reach * dir.y },
    { x: x - reach * perp.x, y: y - reach * perp.y }
  ]
}

/** Radius of a filled circle head, centred on the end. */
export function circleCapRadius(weight: number): number {
  return CIRCLE_HEAD_RADIUS * weight
}

function trimsShaft(cap: StrokeCap | undefined): boolean {
  return cap === 'TRIANGLE_FILLED' || cap === 'ARROW_EQUILATERAL'
}

/** Whether any open end of `network` carries a head the line stops short of. */
export function hasTrimmedShaft(network: VectorNetwork, fallbackCap: StrokeCap): boolean {
  return network.vertices.some((vertex) =>
    trimsShaft((vertex.strokeCap as StrokeCap | undefined) ?? fallbackCap)
  )
}

/**
 * The network with its line pulled back from each open end that carries a triangle or
 * equilateral head, as Figma draws it, so the line's own cap stays inside the head.
 */
export function trimArrowShafts(
  network: VectorNetwork,
  fallbackCap: StrokeCap,
  weight: number
): VectorNetwork {
  const trimmed = structuredClone(network)
  for (const endpoint of collectArrowEndpoints(network, fallbackCap)) {
    if (!trimsShaft(endpoint.cap)) continue
    const index = network.vertices.findIndex(
      (vertex) => vertex.x === endpoint.x && vertex.y === endpoint.y
    )
    const segment = trimmed.segments.find(
      (candidate) => candidate.start === index || candidate.end === index
    )
    if (index === -1 || !segment) continue
    trimSegmentEnd(trimmed, segment, segment.end === index, SHAFT_TRIM * weight)
  }
  return trimmed
}

type Cubic = [Vector, Vector, Vector, Vector]

function cubicAt([a, b, c, d]: Cubic, t: number): Vector {
  const u = 1 - t
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y
  }
}

function lerp(a: Vector, b: Vector, t: number): Vector {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** The part of a cubic from its start to `t`, by de Casteljau. */
function cubicHead([a, b, c, d]: Cubic, t: number): Cubic {
  const ab = lerp(a, b, t)
  const bc = lerp(b, c, t)
  const cd = lerp(c, d, t)
  const abc = lerp(ab, bc, t)
  const bcd = lerp(bc, cd, t)
  return [a, ab, abc, lerp(abc, bcd, t)]
}

/**
 * Pulls one end of `segment` back along it until it lies `distance` from where it was, keeping
 * the rest of the curve where it is.
 */
function trimSegmentEnd(
  network: VectorNetwork,
  segment: VectorNetwork['segments'][number],
  atEnd: boolean,
  distance: number
) {
  const start = network.vertices[segment.start]
  const end = network.vertices[segment.end]
  // Oriented so the trimmed end comes last.
  const from = atEnd ? start : end
  const to = atEnd ? end : start
  const out = atEnd ? segment.tangentStart : segment.tangentEnd
  const back = atEnd ? segment.tangentEnd : segment.tangentStart
  const cubic: Cubic = [
    { x: from.x, y: from.y },
    { x: from.x + out.x, y: from.y + out.y },
    { x: to.x + back.x, y: to.y + back.y },
    { x: to.x, y: to.y }
  ]
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  if (length <= distance) return
  const index = atEnd ? segment.end : segment.start
  const isStraight = out.x === 0 && out.y === 0 && back.x === 0 && back.y === 0
  if (isStraight) {
    // A straight segment stays straight, so the corner before it keeps its radius.
    const keep = (length - distance) / length
    const vertex = network.vertices[index]
    network.vertices[index] = {
      ...vertex,
      x: from.x + (to.x - from.x) * keep,
      y: from.y + (to.y - from.y) * keep
    }
    return
  }
  let low = 0
  let high = 1
  for (let step = 0; step < 40; step++) {
    const t = (low + high) / 2
    const point = cubicAt(cubic, t)
    if (Math.hypot(point.x - to.x, point.y - to.y) > distance) low = t
    else high = t
  }
  const [, c1, c2, tip] = cubicHead(cubic, low)
  network.vertices[index] = { ...network.vertices[index], x: tip.x, y: tip.y }
  const kept = { x: c1.x - from.x, y: c1.y - from.y }
  const trimmedBack = { x: c2.x - tip.x, y: c2.y - tip.y }
  if (atEnd) {
    segment.tangentStart = kept
    segment.tangentEnd = trimmedBack
  } else {
    segment.tangentEnd = kept
    segment.tangentStart = trimmedBack
  }
}

/** Arrow endpoints for a LINE node, whose local geometry runs (0,0) → (width,height). */
export function lineArrowEndpoints(width: number, height: number, cap: StrokeCap): ArrowEndpoint[] {
  if (!isArrowCap(cap)) return []
  if (width === 0 && height === 0) return []
  const angle = Math.atan2(height, width)
  return [
    { x: 0, y: 0, angle: Math.atan2(-height, -width), cap },
    { x: width, y: height, angle, cap }
  ]
}
