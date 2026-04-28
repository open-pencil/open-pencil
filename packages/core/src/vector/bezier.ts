import { evalCubic, isLineSegment, segmentToAbsolute, splitCubicAt } from './curve-math'
import { reindexRegionLoops, remapRegions } from './regions'
export {
  computeAccurateBounds,
  cubicExtrema,
  evalCubic,
  isLineSegment,
  nearestPointOnCubic,
  nearestPointOnNetwork,
  segmentToAbsolute,
  splitCubicAt,
  type CubicPoints,
  type NearestResult,
  type NetworkNearestResult
} from './curve-math'

import type { VectorNetwork, VectorSegment, VectorVertex } from '#core/scene-graph'
import type { Vector } from '#core/types'

function finishSplitSegment(
  network: VectorNetwork,
  newVertices: VectorVertex[],
  newSegments: VectorSegment[],
  segmentIndex: number,
  seg1: VectorSegment,
  seg2: VectorSegment,
  newVertexIndex: number
): { network: VectorNetwork; newVertexIndex: number } {
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

    return finishSplitSegment(network, newVertices, newSegments, segmentIndex, seg1, seg2, newVertexIndex)
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

  return finishSplitSegment(network, newVertices, newSegments, segmentIndex, seg1, seg2, newVertexIndex)
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
  let c = 1
  if (Math.abs(inner.x) > Math.abs(inner.y)) {
    if (inner.x !== 0) c = rhs.x / inner.x
  } else if (inner.y !== 0) {
    c = rhs.y / inner.y
  }
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
export { extractSubNetwork, findConnectedComponents } from './connectivity'
