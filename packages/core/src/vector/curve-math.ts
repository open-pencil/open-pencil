import type { VectorNetwork, VectorSegment } from '@open-pencil/scene-graph'
import {
  cubicExtrema as curveExtrema,
  cubicPoint,
  vectorNetworkBounds
} from '@open-pencil/scene-graph/geometry'
import type { Vector } from '@open-pencil/scene-graph/primitives'

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

/** Parameters in (0, 1) where a cubic is level on one axis. */
export const cubicExtrema = curveExtrema

/** Tight axis-aligned bounds of a vector network, including the peaks of its curves. */
export const computeAccurateBounds = vectorNetworkBounds

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
    const pt = cubicPoint(p0, cp1, cp2, p3, t)
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
      const pt = cubicPoint(p0, cp1, cp2, p3, t)
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

  const pt = cubicPoint(p0, cp1, cp2, p3, bestT)
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
  return { t, x, y, distance: Math.hypot(ddx, ddy) }
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
