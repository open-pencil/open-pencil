import type { VectorNetwork, VectorSegment, VectorVertex, VectorRegion } from './scene-graph'
/* eslint-disable max-lines -- Bezier/network utilities kept together for shared geometry math */
/**
 * Pure-JS bezier math utilities for VectorNetwork manipulation.
 * Replaces Paper.js dependency from the reference implementation.
 */
import type { Vector, Rect } from './types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
export function splitSegmentAt(
  network: VectorNetwork,
  segmentIndex: number,
  t: number
): { network: VectorNetwork; newVertexIndex: number } {
  const seg = network.segments[segmentIndex]
  const v0 = network.vertices[seg.start]
  const v1 = network.vertices[seg.end]

  // New vertex array (append new vertex at end)
  const newVertexIndex = network.vertices.length
  const newVertices = [...network.vertices]

  // New segments array — replace the original with two new ones
  const newSegments = [...network.segments]

  if (isLineSegment(seg)) {
    // Line split: simply interpolate
    const mx = v0.x + t * (v1.x - v0.x)
    const my = v0.y + t * (v1.y - v0.y)

    newVertices.push({ x: mx, y: my, handleMirroring: 'NONE' })

    const seg1: VectorSegment = {
      start: seg.start,
      end: newVertexIndex,
      tangentStart: { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 }
    }
    const seg2: VectorSegment = {
      start: newVertexIndex,
      end: seg.end,
      tangentStart: { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 }
    }

    // Replace original segment with first; insert second after
    const newSegIdx2 = newSegments.length
    newSegments[segmentIndex] = seg1
    newSegments.push(seg2)

    const regions = reindexRegionLoops(
      network.regions,
      segmentIndex,
      [segmentIndex, newSegIdx2],
      network.segments
    )

    return {
      network: { vertices: newVertices, segments: newSegments, regions },
      newVertexIndex
    }
  }

  // Cubic split via De Casteljau
  const { p0, cp1, cp2, p3 } = segmentToAbsolute(network, segmentIndex)
  const { left, right } = splitCubicAt(p0, cp1, cp2, p3, t)

  // New vertex at the split point
  newVertices.push({ x: left.p3.x, y: left.p3.y, handleMirroring: 'ANGLE_AND_LENGTH' })

  // Convert absolute control points back to relative tangent offsets
  const seg1: VectorSegment = {
    start: seg.start,
    end: newVertexIndex,
    tangentStart: { x: left.cp1.x - v0.x, y: left.cp1.y - v0.y },
    tangentEnd: { x: left.cp2.x - left.p3.x, y: left.cp2.y - left.p3.y }
  }
  const seg2: VectorSegment = {
    start: newVertexIndex,
    end: seg.end,
    tangentStart: { x: right.cp1.x - left.p3.x, y: right.cp1.y - left.p3.y },
    tangentEnd: { x: right.cp2.x - v1.x, y: right.cp2.y - v1.y }
  }

  const newSegIdx2 = newSegments.length
  newSegments[segmentIndex] = seg1
  newSegments.push(seg2)

  const regions = reindexRegionLoops(
    network.regions,
    segmentIndex,
    [segmentIndex, newSegIdx2],
    network.segments
  )

  return {
    network: { vertices: newVertices, segments: newSegments, regions },
    newVertexIndex
  }
}

function buildMergedSegmentForRemovedVertex(
  vertices: VectorVertex[],
  segments: VectorSegment[],
  connectedSegs: number[],
  vertexIndex: number,
  reindex: (idx: number) => number
): VectorSegment {
  const segA = segments[connectedSegs[0]]
  const segB = segments[connectedSegs[1]]

  const neighborA = segA.start === vertexIndex ? segA.end : segA.start
  const neighborB = segB.start === vertexIndex ? segB.end : segB.start

  const dirA =
    segA.start === vertexIndex
      ? { x: segA.tangentEnd.x, y: segA.tangentEnd.y }
      : { x: segA.tangentStart.x, y: segA.tangentStart.y }

  const dirB =
    segB.start === vertexIndex
      ? { x: segB.tangentEnd.x, y: segB.tangentEnd.y }
      : { x: segB.tangentStart.x, y: segB.tangentStart.y }

  const vA = vertices[neighborA]
  const vR = vertices[vertexIndex]
  const vB = vertices[neighborB]

  const dA = Math.hypot(vR.x - vA.x, vR.y - vA.y)
  const dB = Math.hypot(vB.x - vR.x, vB.y - vR.y)
  const totalLen = dA + dB
  const t = totalLen > 1e-6 ? dA / totalLen : 0.5
  const mt = 1 - t

  const scaleA = mt > 1e-6 ? 1 / mt : 1
  const scaleB = t > 1e-6 ? 1 / t : 1
  const scaledTS: Vector = { x: dirA.x * scaleA, y: dirA.y * scaleA }
  const scaledTE: Vector = { x: dirB.x * scaleB, y: dirB.y * scaleB }

  const ptScaled = evalCubic(
    vA.x,
    vA.y,
    vA.x + scaledTS.x,
    vA.y + scaledTS.y,
    vB.x + scaledTE.x,
    vB.y + scaledTE.y,
    vB.x,
    vB.y,
    t
  )
  const scaledDev = Math.hypot(ptScaled.x - vR.x, ptScaled.y - vR.y)

  const tangents =
    scaledDev < totalLen * 0.05
      ? { tangentStart: scaledTS, tangentEnd: scaledTE }
      : solveMergedTangents(vA, vR, vB, dirA, dirB, mt, t)

  return {
    start: reindex(neighborA),
    end: reindex(neighborB),
    tangentStart: tangents.tangentStart,
    tangentEnd: tangents.tangentEnd
  }
}

function solveMergedTangents(
  vA: Vector,
  vR: Vector,
  vB: Vector,
  dirA: Vector,
  dirB: Vector,
  mt: number,
  t: number
): { tangentStart: Vector; tangentEnd: Vector } {
  const b1 = 3 * mt * mt * t
  const b2 = 3 * mt * t * t
  const rhs = {
    x: vR.x - (mt * mt * mt + b1) * vA.x - (t * t * t + b2) * vB.x,
    y: vR.y - (mt * mt * mt + b1) * vA.y - (t * t * t + b2) * vB.y
  }

  const det = b1 * dirA.x * b2 * dirB.y - b1 * dirA.y * b2 * dirB.x
  if (Math.abs(det) > 1e-9) {
    const alpha = (rhs.x * b2 * dirB.y - rhs.y * b2 * dirB.x) / det
    const beta = (b1 * dirA.x * rhs.y - b1 * dirA.y * rhs.x) / det
    return {
      tangentStart: { x: alpha * dirA.x, y: alpha * dirA.y },
      tangentEnd: { x: beta * dirB.x, y: beta * dirB.y }
    }
  }

  const toRA = { x: vR.x - vA.x, y: vR.y - vA.y }
  const toRB = { x: vR.x - vB.x, y: vR.y - vB.y }
  const inner = { x: b1 * toRA.x + b2 * toRB.x, y: b1 * toRA.y + b2 * toRB.y }
  const c =
    Math.abs(inner.x) > Math.abs(inner.y)
      ? (inner.x !== 0 ? rhs.x / inner.x : 1)
      : (inner.y !== 0 ? rhs.y / inner.y : 1)
  return {
    tangentStart: { x: c * toRA.x, y: c * toRA.y },
    tangentEnd: { x: c * toRB.x, y: c * toRB.y }
  }
}

function buildSegmentsAfterRemoval(
  segments: VectorSegment[],
  reindex: (idx: number) => number,
  removedSet: Set<number>,
  mergedSeg?: VectorSegment
): { segments: VectorSegment[]; indexMap: Map<number, number | null> } {
  const newSegments: VectorSegment[] = []
  const segIndexMap = new Map<number, number | null>()
  let mergedIdx = -1

  for (let i = 0; i < segments.length; i++) {
    if (!removedSet.has(i)) {
      const s = segments[i]
      segIndexMap.set(i, newSegments.length)
      newSegments.push({
        start: reindex(s.start),
        end: reindex(s.end),
        tangentStart: { ...s.tangentStart },
        tangentEnd: { ...s.tangentEnd }
      })
      continue
    }

    if (!mergedSeg) {
      segIndexMap.set(i, null)
      continue
    }
    if (mergedIdx === -1) {
      mergedIdx = newSegments.length
      newSegments.push(mergedSeg)
    }
    segIndexMap.set(i, mergedIdx)
  }

  return { segments: newSegments, indexMap: segIndexMap }
}

// ---------------------------------------------------------------------------
// Remove vertex from VectorNetwork
// ---------------------------------------------------------------------------

/**
 * Remove a vertex from the network, merging adjacent segments if possible.
 * Returns null if the vertex cannot be removed (e.g., 0 vertices remain).
 */
export function removeVertex(network: VectorNetwork, vertexIndex: number): VectorNetwork | null {
  const { vertices, segments, regions } = network

  // Find all segments connected to this vertex
  const connectedSegs: number[] = []
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].start === vertexIndex || segments[i].end === vertexIndex) {
      connectedSegs.push(i)
    }
  }

  if (vertices.length <= 1) return null

  // Build new vertex list without the removed vertex
  const newVertices = vertices.filter((_, i) => i !== vertexIndex)
  const reindex = (idx: number): number => (idx > vertexIndex ? idx - 1 : idx)

  if (connectedSegs.length === 2) {
    const mergedSeg = buildMergedSegmentForRemovedVertex(
      vertices,
      segments,
      connectedSegs,
      vertexIndex,
      reindex
    )
    const removedSet = new Set(connectedSegs)
    const result = buildSegmentsAfterRemoval(segments, reindex, removedSet, mergedSeg)
    const newRegions = remapRegions(regions, result.indexMap)
    return { vertices: newVertices, segments: result.segments, regions: newRegions }
  }

  const removedSegSet = new Set(connectedSegs)
  const result = buildSegmentsAfterRemoval(segments, reindex, removedSegSet)
  const newRegions = remapRegions(regions, result.indexMap)
  return { vertices: newVertices, segments: result.segments, regions: newRegions }
}

// ---------------------------------------------------------------------------
// Delete vertex with all connected segments
// ---------------------------------------------------------------------------

/**
 * Delete a vertex and ALL segments connected to it.
 * Unlike removeVertex (which merges adjacent segments), this breaks the path.
 * Returns null if the network would become empty.
 */
export function deleteVertex(network: VectorNetwork, vertexIndex: number): VectorNetwork | null {
  const { vertices, segments } = network
  if (vertices.length <= 1) return null

  const connectedSet = new Set<number>()
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].start === vertexIndex || segments[i].end === vertexIndex) {
      connectedSet.add(i)
    }
  }

  const newVertices = vertices.filter((_, i) => i !== vertexIndex)
  const reindex = (idx: number): number => (idx > vertexIndex ? idx - 1 : idx)

  const newSegments: VectorSegment[] = []
  for (let i = 0; i < segments.length; i++) {
    if (connectedSet.has(i)) continue
    newSegments.push({
      ...segments[i],
      start: reindex(segments[i].start),
      end: reindex(segments[i].end)
    })
  }

  // Regions are invalidated when segments are removed
  return { vertices: newVertices, segments: newSegments, regions: [] }
}

// Break network at vertex
// ---------------------------------------------------------------------------

/**
 * Break the network at a vertex — duplicates the vertex so connected
 * segments are split into two groups. For closed paths this "opens" them.
 */
export function breakAtVertex(network: VectorNetwork, vertexIndex: number): VectorNetwork {
  const { vertices, segments } = network

  // Find connected segments and split them into "incoming" and "outgoing"
  const incoming: number[] = []
  const outgoing: number[] = []

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    if (s.end === vertexIndex) incoming.push(i)
    else if (s.start === vertexIndex) outgoing.push(i)
  }

  // If vertex has connections in only one direction, nothing to break
  if (incoming.length === 0 || outgoing.length === 0) return network

  // Duplicate the vertex
  const dupIndex = vertices.length
  const newVertices = [...vertices, { ...vertices[vertexIndex] }]

  // Redirect all outgoing segments to the duplicate
  const newSegments = segments.map((s, i) => {
    if (outgoing.includes(i)) {
      return { ...s, start: dupIndex }
    }
    return { ...s }
  })

  // Clear tangent handles at the break point
  for (const i of incoming) {
    newSegments[i] = { ...newSegments[i], tangentEnd: { x: 0, y: 0 } }
  }
  for (const i of outgoing) {
    newSegments[i] = { ...newSegments[i], tangentStart: { x: 0, y: 0 } }
  }

  // Remove all regions (breaking always opens the path)
  return { vertices: newVertices, segments: newSegments, regions: [] }
}

// ---------------------------------------------------------------------------
// Region loop helpers
// ---------------------------------------------------------------------------

/**
 * Remap segment indices in all region loops.
 * Map value of null means the segment was removed — the loop entry is dropped.
 */
function remapRegions(
  regions: VectorRegion[],
  indexMap: Map<number, number | null>
): VectorRegion[] {
  const result: VectorRegion[] = []

  for (const region of regions) {
    const newLoops: number[][] = []
    for (const loop of region.loops) {
      const newLoop: number[] = []
      for (const idx of loop) {
        const mapped = indexMap.get(idx)
        if (mapped == null) continue
        // Deduplicate: when two merged segments both map to the same index,
        // only include it once (skip consecutive duplicates)
        if (newLoop.length > 0 && newLoop[newLoop.length - 1] === mapped) continue
        newLoop.push(mapped)
      }
      // Also check wrap-around: if last equals first, remove the trailing duplicate
      if (newLoop.length > 1 && newLoop[0] === newLoop[newLoop.length - 1]) {
        newLoop.pop()
      }
      if (newLoop.length >= 2) newLoops.push(newLoop)
    }
    if (newLoops.length > 0) {
      result.push({ ...region, loops: newLoops })
    }
  }

  return result
}
/**
 * Replace a single segment index in all region loops with one or more new indices.
 * Used after splitting a segment.
 *
 * When a segment is split into [seg1, seg2], seg1 goes original.start→mid and
 * seg2 goes mid→original.end. If the loop traverses the original segment backward
 * (end→start), the replacement must be [seg2, seg1] (reversed).
 */
function reindexRegionLoops(
  regions: VectorRegion[],
  oldSegIndex: number,
  newSegIndices: number[],
  segments?: VectorSegment[]
): VectorRegion[] {
  return regions.map((region) => ({
    ...region,
    loops: region.loops.map((loop) => {
      const result: number[] = []
      for (let i = 0; i < loop.length; i++) {
        if (loop[i] !== oldSegIndex) {
          result.push(loop[i])
          continue
        }

        // Determine traversal direction by checking the adjacent segment
        if (!segments || newSegIndices.length < 2) {
          result.push(...newSegIndices)
          continue
        }

        const origSeg = segments[oldSegIndex]
        // Look at the NEXT segment in the loop to determine direction
        const nextIdx = loop[(i + 1) % loop.length]
        const nextSeg = segments[nextIdx]

        // If the original segment's end connects to the next segment,
        // the loop traverses forward → [seg1, seg2]
        // Otherwise backward → [seg2, seg1]
        const endConnectsToNext = origSeg.end === nextSeg.start || origSeg.end === nextSeg.end

        if (endConnectsToNext) {
          result.push(...newSegIndices)
        } else {
          // Backward traversal — reverse the replacement order
          result.push(...[...newSegIndices].reverse())
        }
      }
      return result
    })
  }))
}

// ---------------------------------------------------------------------------
// Handle mirroring
// ---------------------------------------------------------------------------

/**
 * Given a dragged handle vector (relative to vertex), compute the mirrored opposite handle.
 */
export function mirrorHandle(
  handle: Vector,
  mode: 'NONE' | 'ANGLE' | 'ANGLE_AND_LENGTH',
  oppositeLength?: number
): Vector | null {
  switch (mode) {
    case 'NONE':
      return null
    case 'ANGLE_AND_LENGTH':
      return { x: -handle.x, y: -handle.y }
    case 'ANGLE': {
      const len = oppositeLength ?? Math.hypot(handle.x, handle.y)
      const hLen = Math.hypot(handle.x, handle.y)
      if (hLen < 1e-9) return { x: 0, y: 0 }
      const scale = len / hLen
      return { x: -handle.x * scale, y: -handle.y * scale }
    }
  }
  return null
}

/**
 * Find the "opposite" handle for a vertex — i.e., if we're dragging a tangent on
 * segmentIndex that touches vertexIndex, find the other segment touching the same vertex
 * and return its index and which tangent field belongs to that vertex.
 */
export function findOppositeHandle(
  network: VectorNetwork,
  vertexIndex: number,
  segmentIndex: number
): { segmentIndex: number; tangentField: 'tangentStart' | 'tangentEnd' } | null {
  for (let i = 0; i < network.segments.length; i++) {
    if (i === segmentIndex) continue
    const s = network.segments[i]
    if (s.start === vertexIndex) return { segmentIndex: i, tangentField: 'tangentStart' }
    if (s.end === vertexIndex) return { segmentIndex: i, tangentField: 'tangentEnd' }
  }
  return null
}

/**
 * Find all handles (tangent fields) connected to a vertex, along with neighbor info.
 * Returns an array of { segmentIndex, tangentField, neighborVertexIndex } for each
 * segment that touches the given vertex.
 */
export function findAllHandles(
  network: VectorNetwork,
  vertexIndex: number
): { segmentIndex: number; tangentField: 'tangentStart' | 'tangentEnd'; neighborIndex: number }[] {
  const result: {
    segmentIndex: number
    tangentField: 'tangentStart' | 'tangentEnd'
    neighborIndex: number
  }[] = []
  for (let i = 0; i < network.segments.length; i++) {
    const s = network.segments[i]
    if (s.start === vertexIndex) {
      result.push({ segmentIndex: i, tangentField: 'tangentStart', neighborIndex: s.end })
    }
    if (s.end === vertexIndex) {
      result.push({ segmentIndex: i, tangentField: 'tangentEnd', neighborIndex: s.start })
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Network connectivity
// ---------------------------------------------------------------------------

/**
 * Find connected components in a VectorNetwork.
 * Returns arrays of vertex indices for each component.
 */
export function findConnectedComponents(network: VectorNetwork): number[][] {
  const n = network.vertices.length
  if (n === 0) return []

  const adj = new Map<number, Set<number>>()
  for (const seg of network.segments) {
    if (!adj.has(seg.start)) adj.set(seg.start, new Set())
    if (!adj.has(seg.end)) adj.set(seg.end, new Set())
    const from = adj.get(seg.start)
    const to = adj.get(seg.end)
    if (!from || !to) continue
    from.add(seg.end)
    to.add(seg.start)
  }

  const visited = new Set<number>()
  const components: number[][] = []

  for (let i = 0; i < n; i++) {
    if (visited.has(i)) continue
    const component: number[] = []
    const stack = [i]
    while (stack.length > 0) {
      const v = stack.pop()
      if (v === undefined) continue
      if (visited.has(v)) continue
      visited.add(v)
      component.push(v)
      const neighbors = adj.get(v)
      if (neighbors) {
        for (const nb of neighbors) {
          if (!visited.has(nb)) stack.push(nb)
        }
      }
    }
    components.push(component)
  }

  return components
}

/**
 * Extract a sub-network from a VectorNetwork given a set of vertex indices.
 */
export function extractSubNetwork(network: VectorNetwork, vertexIndices: number[]): VectorNetwork {
  const indexSet = new Set(vertexIndices)
  const oldToNew = new Map<number, number>()
  const newVertices: VectorVertex[] = []

  for (const idx of vertexIndices) {
    oldToNew.set(idx, newVertices.length)
    newVertices.push({ ...network.vertices[idx] })
  }

  const newSegments: VectorSegment[] = []
  const segOldToNew = new Map<number, number>()

  for (let i = 0; i < network.segments.length; i++) {
    const s = network.segments[i]
    if (indexSet.has(s.start) && indexSet.has(s.end)) {
      segOldToNew.set(i, newSegments.length)
      const start = oldToNew.get(s.start)
      const end = oldToNew.get(s.end)
      if (start === undefined || end === undefined) continue
      newSegments.push({
        start,
        end,
        tangentStart: { ...s.tangentStart },
        tangentEnd: { ...s.tangentEnd }
      })
    }
  }

  // Remap regions
  const newRegions: VectorRegion[] = []
  for (const region of network.regions) {
    const newLoops: number[][] = []
    for (const loop of region.loops) {
      const newLoop = loop
        .map((i) => segOldToNew.get(i))
        .filter((i): i is number => i !== undefined)
      if (newLoop.length >= 2) newLoops.push(newLoop)
    }
    if (newLoops.length > 0) newRegions.push({ ...region, loops: newLoops })
  }

  return { vertices: newVertices, segments: newSegments, regions: newRegions }
}
