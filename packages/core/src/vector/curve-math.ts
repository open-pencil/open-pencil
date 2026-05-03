import type { VectorNetwork, VectorSegment } from '#core/scene-graph'
import type { Vector, Rect } from '#core/types'

export interface CubicPoints {
  p0: Vector
  cp1: Vector
  cp2: Vector
  p3: Vector
}

export interface NearestResult {
  t: number
  x: number
  y: number
  distance: number
}

export interface NetworkNearestResult extends NearestResult {
  segmentIndex: number
}

// ---------------------------------------------------------------------------
// De Casteljau evaluation
// ---------------------------------------------------------------------------

/** Evaluate a cubic bezier at parameter t (0..1). */
export function evalCubic(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  t: number
): Vector {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t
  const a = mt2 * mt
  const b = 3 * mt2 * t
  const c = 3 * mt * t2
  const d = t2 * t
  return {
    x: a * p0x + b * p1x + c * p2x + d * p3x,
    y: a * p0y + b * p1y + c * p2y + d * p3y
  }
}

// ---------------------------------------------------------------------------
// Curve splitting (De Casteljau subdivision)
// ---------------------------------------------------------------------------

/** Split a cubic bezier at parameter t, returning two sub-curves. */
export function splitCubicAt(
  p0: Vector,
  cp1: Vector,
  cp2: Vector,
  p3: Vector,
  t: number
): { left: CubicPoints; right: CubicPoints } {
  const mt = 1 - t

  // Level 1
  const m01x = mt * p0.x + t * cp1.x
  const m01y = mt * p0.y + t * cp1.y
  const m12x = mt * cp1.x + t * cp2.x
  const m12y = mt * cp1.y + t * cp2.y
  const m23x = mt * cp2.x + t * p3.x
  const m23y = mt * cp2.y + t * p3.y

  // Level 2
  const m012x = mt * m01x + t * m12x
  const m012y = mt * m01y + t * m12y
  const m123x = mt * m12x + t * m23x
  const m123y = mt * m12y + t * m23y

  // Level 3 — the split point
  const mx = mt * m012x + t * m123x
  const my = mt * m012y + t * m123y

  return {
    left: {
      p0: { x: p0.x, y: p0.y },
      cp1: { x: m01x, y: m01y },
      cp2: { x: m012x, y: m012y },
      p3: { x: mx, y: my }
    },
    right: {
      p0: { x: mx, y: my },
      cp1: { x: m123x, y: m123y },
      cp2: { x: m23x, y: m23y },
      p3: { x: p3.x, y: p3.y }
    }
  }
}

// ---------------------------------------------------------------------------
// Segment ↔ absolute control points conversion
// ---------------------------------------------------------------------------

/** Convert a VectorSegment's relative tangents to absolute control points. */
export function segmentToAbsolute(network: VectorNetwork, segmentIndex: number): CubicPoints {
  const seg = network.segments[segmentIndex]
  const v0 = network.vertices[seg.start]
  const v1 = network.vertices[seg.end]
  return {
    p0: { x: v0.x, y: v0.y },
    cp1: { x: v0.x + seg.tangentStart.x, y: v0.y + seg.tangentStart.y },
    cp2: { x: v1.x + seg.tangentEnd.x, y: v1.y + seg.tangentEnd.y },
    p3: { x: v1.x, y: v1.y }
  }
}

/** Check if a segment is a straight line (both tangents zero). */
export function isLineSegment(seg: VectorSegment): boolean {
  return (
    seg.tangentStart.x === 0 &&
    seg.tangentStart.y === 0 &&
    seg.tangentEnd.x === 0 &&
    seg.tangentEnd.y === 0
  )
}

// ---------------------------------------------------------------------------
// Accurate bezier bounds via cubic extrema
// ---------------------------------------------------------------------------

/**
 * Find parameter values where the cubic derivative is zero (extrema) in one axis.
 * Given cubic coefficients for one axis: B(t) = (1-t)^3*p0 + 3(1-t)^2*t*p1 + 3(1-t)*t^2*p2 + t^3*p3
 * Derivative: B'(t) = 3[(1-t)^2(p1-p0) + 2(1-t)t(p2-p1) + t^2(p3-p2)]
 * Expanding: at^2 + bt + c = 0 where:
 *   a = -p0 + 3p1 - 3p2 + p3
 *   b = 2(p0 - 2p1 + p2)
 *   c = -p0 + p1
 */
export function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3
  const b = 2 * (p0 - 2 * p1 + p2)
  const c = -p0 + p1

  const results: number[] = []
  const EPS = 1e-12

  if (Math.abs(a) < EPS) {
    // Linear: bt + c = 0
    if (Math.abs(b) > EPS) {
      const t = -c / b
      if (t > 0 && t < 1) results.push(t)
    }
  } else {
    const disc = b * b - 4 * a * c
    if (disc >= 0) {
      const sq = Math.sqrt(disc)
      const t1 = (-b + sq) / (2 * a)
      const t2 = (-b - sq) / (2 * a)
      if (t1 > 0 && t1 < 1) results.push(t1)
      if (t2 > 0 && t2 < 1 && Math.abs(t2 - t1) > EPS) results.push(t2)
    }
  }

  return results
}

/** Compute tight axis-aligned bounding box for a VectorNetwork. */
export function computeAccurateBounds(network: VectorNetwork): Rect {
  const { vertices, segments } = network
  if (vertices.length === 0) return { x: 0, y: 0, width: 0, height: 0 }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity

  const update = (x: number, y: number) => {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }

  // Include all vertex positions
  for (const v of vertices) update(v.x, v.y)

  // For each segment, find curve extrema
  for (let i = 0; i < segments.length; i++) {
    const { p0, cp1, cp2, p3 } = segmentToAbsolute(network, i)

    // X extrema
    for (const t of cubicExtrema(p0.x, cp1.x, cp2.x, p3.x)) {
      const pt = evalCubic(p0.x, p0.y, cp1.x, cp1.y, cp2.x, cp2.y, p3.x, p3.y, t)
      update(pt.x, pt.y)
    }

    // Y extrema
    for (const t of cubicExtrema(p0.y, cp1.y, cp2.y, p3.y)) {
      const pt = evalCubic(p0.x, p0.y, cp1.x, cp1.y, cp2.x, cp2.y, p3.x, p3.y, t)
      update(pt.x, pt.y)
    }
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

// ---------------------------------------------------------------------------
// Nearest point on cubic bezier
// ---------------------------------------------------------------------------

/**
 * Find the nearest point on a cubic bezier to a given point (px, py).
 * Uses coarse sampling + iterative refinement.
 */
export function nearestPointOnCubic(
  px: number,
  py: number,
  p0: Vector,
  cp1: Vector,
  cp2: Vector,
  p3: Vector,
  coarseSamples: number = 64
): NearestResult {
  let bestT = 0
  let bestDist = Infinity

  // Coarse sampling
  for (let i = 0; i <= coarseSamples; i++) {
    const t = i / coarseSamples
    const pt = evalCubic(p0.x, p0.y, cp1.x, cp1.y, cp2.x, cp2.y, p3.x, p3.y, t)
    const dx = pt.x - px
    const dy = pt.y - py
    const d = dx * dx + dy * dy
    if (d < bestDist) {
      bestDist = d
      bestT = t
    }
  }

  // Refinement — bisect around best sample, 5 iterations
  let lo = Math.max(0, bestT - 1 / coarseSamples)
  let hi = Math.min(1, bestT + 1 / coarseSamples)

  for (let iter = 0; iter < 5; iter++) {
    const step = (hi - lo) / 4
    let localBestT = lo
    let localBestDist = Infinity

    for (let i = 0; i <= 4; i++) {
      const t = lo + step * i
      const pt = evalCubic(p0.x, p0.y, cp1.x, cp1.y, cp2.x, cp2.y, p3.x, p3.y, t)
      const dx = pt.x - px
      const dy = pt.y - py
      const d = dx * dx + dy * dy
      if (d < localBestDist) {
        localBestDist = d
        localBestT = t
      }
    }

    bestT = localBestT
    bestDist = localBestDist
    lo = Math.max(0, bestT - step)
    hi = Math.min(1, bestT + step)
  }

  const pt = evalCubic(p0.x, p0.y, cp1.x, cp1.y, cp2.x, cp2.y, p3.x, p3.y, bestT)
  return { t: bestT, x: pt.x, y: pt.y, distance: Math.sqrt(bestDist) }
}

/** Find nearest point on a straight line segment. */
function nearestPointOnLine(px: number, py: number, p0: Vector, p1: Vector): NearestResult {
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const lenSq = dx * dx + dy * dy

  let t: number
  if (lenSq < 1e-12) {
    t = 0
  } else {
    t = Math.max(0, Math.min(1, ((px - p0.x) * dx + (py - p0.y) * dy) / lenSq))
  }

  const x = p0.x + t * dx
  const y = p0.y + t * dy
  const ddx = x - px
  const ddy = y - py
  return { t, x, y, distance: Math.sqrt(ddx * ddx + ddy * ddy) }
}

/** Find nearest point across all segments in a VectorNetwork. */
export function nearestPointOnNetwork(
  px: number,
  py: number,
  network: VectorNetwork,
  threshold: number
): NetworkNearestResult | null {
  let best: NetworkNearestResult | null = null

  for (let i = 0; i < network.segments.length; i++) {
    const seg = network.segments[i]
    let result: NearestResult

    if (isLineSegment(seg)) {
      const v0 = network.vertices[seg.start]
      const v1 = network.vertices[seg.end]
      result = nearestPointOnLine(px, py, v0, v1)
    } else {
      const { p0, cp1, cp2, p3 } = segmentToAbsolute(network, i)
      result = nearestPointOnCubic(px, py, p0, cp1, cp2, p3)
    }

    if (result.distance <= threshold && (!best || result.distance < best.distance)) {
      best = { ...result, segmentIndex: i }
    }
  }

  return best
}

// ---------------------------------------------------------------------------
// Split segment within a VectorNetwork
// ---------------------------------------------------------------------------

/**
 * Split a segment in a VectorNetwork at parameter t, inserting a new vertex.
 * Returns a new VectorNetwork with updated vertices, segments, and regions.
 */
