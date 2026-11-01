import { isEqual } from 'es-toolkit/predicate'

import { copyVectorRegion } from './copy'
import type { Mat3 } from './matrix'
import type { VectorPathWindingRule } from './parse-path'
import type { Vector } from './primitives'
import type { Fill, GeometryPath, VectorNetwork, VectorSegment, VectorVertex } from './types'

/** Concatenate vector networks while preserving independent geometry. */
export function mergeVectorNetworks(networks: readonly VectorNetwork[]): VectorNetwork {
  const vertices: VectorNetwork['vertices'] = []
  const segments: VectorNetwork['segments'] = []
  const regions: VectorNetwork['regions'] = []
  let vertexOffset = 0
  let segmentOffset = 0

  for (const network of networks) {
    for (const vertex of network.vertices) vertices.push({ ...vertex })
    for (const segment of network.segments) {
      segments.push({
        ...segment,
        start: segment.start + vertexOffset,
        end: segment.end + vertexOffset,
        tangentStart: { ...segment.tangentStart },
        tangentEnd: { ...segment.tangentEnd }
      })
    }
    for (const region of network.regions) {
      const loops: number[][] = []
      for (const loop of region.loops) {
        const shifted: number[] = []
        for (const segmentIndex of loop) shifted.push(segmentIndex + segmentOffset)
        loops.push(shifted)
      }
      regions.push(copyVectorRegion(region, loops))
    }
    vertexOffset += network.vertices.length
    segmentOffset += network.segments.length
  }

  return { vertices, segments, regions }
}

/**
 * Map a VectorNetwork through an affine matrix: vertices as points,
 * tangents as direction vectors (linear part only, no translation).
 * Returns a deep copy; the input is not mutated.
 */
export function transformVectorNetwork(m: Mat3, vn: VectorNetwork): VectorNetwork {
  const mapVector = (v: Vector): Vector => ({
    x: m[0] * v.x + m[1] * v.y,
    y: m[3] * v.x + m[4] * v.y
  })
  return {
    vertices: vn.vertices.map((v) => ({
      ...v,
      x: m[0] * v.x + m[1] * v.y + m[2],
      y: m[3] * v.x + m[4] * v.y + m[5]
    })),
    segments: vn.segments.map((s) => ({
      ...s,
      tangentStart: mapVector(s.tangentStart),
      tangentEnd: mapVector(s.tangentEnd)
    })),
    regions: vn.regions.map((r) => copyVectorRegion(r))
  }
}

/** Whether any region has paints of its own, which it draws instead of the layer's fills. */
export function hasRegionFills(network: VectorNetwork | null): boolean {
  return network?.regions.some((region) => region.fills !== undefined) ?? false
}

/**
 * Whether fill geometry is the regions' outlines, one each, as a file or an edit writes it. A
 * pasted vector has none, and an import skips empty outlines; their regions draw traced.
 */
export function fillGeometryMatchesRegions(
  fillGeometry: readonly GeometryPath[],
  network: VectorNetwork
): boolean {
  return fillGeometry.length === network.regions.length
}

/** The paints regions carry of their own. */
export function regionFills(network: VectorNetwork | null): Fill[] {
  return network?.regions.flatMap((region) => region.fills ?? []) ?? []
}

/** Structural equality of two VectorNetworks (order-sensitive, exact values). */
export function vectorNetworksEqual(a: VectorNetwork, b: VectorNetwork): boolean {
  return (
    isEqual(a.vertices, b.vertices) &&
    isEqual(a.segments, b.segments) &&
    isEqual(a.regions, b.regions)
  )
}

/**
 * Validate a VectorNetwork structure, returning an array of error messages.
 * Empty array means the network is valid.
 */
export function validateVectorNetwork(value: unknown): string[] {
  if (!isRecord(value)) return ['network must be an object']
  if (!Array.isArray(value.vertices)) return ['vertices must be an array']
  if (!Array.isArray(value.segments)) return ['segments must be an array']

  const errors: string[] = []
  validateVertices(value.vertices, errors)
  validateSegments(value.segments, value.vertices.length, errors)
  const typedSegments = value.segments.filter(isSegmentRecord)
  if (value.regions !== undefined) {
    if (Array.isArray(value.regions)) {
      validateRegions(
        value.regions,
        value.segments.length,
        typedSegments.length === value.segments.length ? typedSegments : null,
        errors
      )
    } else {
      errors.push('regions must be an array when provided')
    }
  }
  return errors
}

function validateVertices(vertices: unknown[], errors: string[]): void {
  for (let index = 0; index < vertices.length; index++) {
    if (!isFiniteVector(vertices[index])) {
      errors.push(`vertex[${index}]: x and y must be finite numbers`)
    }
  }
}

function validateSegments(segments: unknown[], vertexCount: number, errors: string[]): void {
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]
    if (!isRecord(segment)) {
      errors.push(`segment[${index}] must be an object`)
      continue
    }
    if (!isInteger(segment.start) || !isInteger(segment.end)) {
      errors.push(`segment[${index}]: start and end must be integers`)
      continue
    }
    if (segment.start < 0 || segment.start >= vertexCount) {
      errors.push(`segment[${index}]: start index ${segment.start} out of range`)
    }
    if (segment.end < 0 || segment.end >= vertexCount) {
      errors.push(`segment[${index}]: end index ${segment.end} out of range`)
    }
    validateSegmentTangents(segment, index, errors)
  }
}

function validateSegmentTangents(
  segment: Record<string, unknown>,
  index: number,
  errors: string[]
): void {
  for (const tangentKey of ['tangentStart', 'tangentEnd'] as const) {
    const tangent = segment[tangentKey]
    if (tangent !== undefined && !isFiniteVector(tangent)) {
      errors.push(`segment[${index}]: ${tangentKey} must contain finite x and y numbers`)
    }
  }
}

function validateRegions(
  regions: unknown[],
  segmentCount: number,
  segments: Array<Record<'start' | 'end', number>> | null,
  errors: string[]
): void {
  for (let regionIndex = 0; regionIndex < regions.length; regionIndex++) {
    const region = regions[regionIndex]
    if (!isRecord(region) || !Array.isArray(region.loops)) {
      errors.push(`region[${regionIndex}]: loops must be an array`)
      continue
    }
    if (region.windingRule !== 'NONZERO' && region.windingRule !== 'EVENODD') {
      errors.push(`region[${regionIndex}]: windingRule must be NONZERO or EVENODD`)
    }
    if (region.loops.length === 0) {
      errors.push(`region[${regionIndex}]: loops must contain at least one loop`)
    }
    validateRegionLoops(region.loops, regionIndex, segmentCount, segments, errors)
  }
}

function validateRegionLoops(
  loops: unknown[],
  regionIndex: number,
  segmentCount: number,
  segments: Array<Record<'start' | 'end', number>> | null,
  errors: string[]
): void {
  for (let loopIndex = 0; loopIndex < loops.length; loopIndex++) {
    const loop = loops[loopIndex]
    if (!Array.isArray(loop)) {
      errors.push(`region[${regionIndex}].loop[${loopIndex}] must be an array`)
      continue
    }
    if (loop.length === 0) {
      errors.push(`region[${regionIndex}].loop[${loopIndex}] must contain at least one segment`)
      continue
    }

    const segmentIndices: number[] = []
    for (const segmentIndex of loop) {
      if (!isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= segmentCount) {
        errors.push(
          `region[${regionIndex}].loop[${loopIndex}]: segment index ${String(segmentIndex)} out of range`
        )
      } else {
        segmentIndices.push(segmentIndex)
      }
    }
    if (segmentIndices.length !== loop.length) continue
    if (new Set(segmentIndices).size !== segmentIndices.length) {
      errors.push(`region[${regionIndex}].loop[${loopIndex}] must not repeat segments`)
      continue
    }
    if (segments && !formsContinuousChain(segmentIndices, segments)) {
      errors.push(`region[${regionIndex}].loop[${loopIndex}] segments must form a continuous chain`)
    }
  }
}

function formsContinuousChain(
  indices: number[],
  segments: Array<Record<'start' | 'end', number>>
): boolean {
  if (indices.length <= 1) return true
  const first = segments[indices[0]]
  return followsChain(indices, segments, first.end) || followsChain(indices, segments, first.start)
}

function followsChain(
  indices: number[],
  segments: Array<Record<'start' | 'end', number>>,
  initialEnd: number
): boolean {
  let current = initialEnd
  for (let index = 1; index < indices.length; index++) {
    const segment = segments[indices[index]]
    if (segment.start === current) current = segment.end
    else if (segment.end === current) current = segment.start
    else return false
  }
  return true
}

function isSegmentRecord(value: unknown): value is Record<'start' | 'end', number> {
  return isRecord(value) && isInteger(value.start) && isInteger(value.end)
}

function isFiniteVector(value: unknown): value is Vector {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y)
  )
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export type NormalizableVectorNetwork = Omit<VectorNetwork, 'regions'> & {
  regions?: VectorNetwork['regions']
}

/**
 * Ensure every segment has tangentStart/tangentEnd and a regions array.
 * Missing tangents default to {x:0, y:0} (straight line segments).
 * Use at system boundaries where input may come from JSON/MCP.
 */
export function normalizeVectorNetwork(vn: NormalizableVectorNetwork): VectorNetwork {
  const ZERO: Vector = { x: 0, y: 0 }
  return {
    vertices: vn.vertices,
    segments: vn.segments.map((s) => ({
      start: s.start,
      end: s.end,
      tangentStart: (s as Partial<VectorSegment>).tangentStart ?? { ...ZERO },
      tangentEnd: (s as Partial<VectorSegment>).tangentEnd ?? { ...ZERO }
    })),
    regions: vn.regions ?? []
  }
}

function coordinate(value: number, decimals: number | null): number {
  if (decimals === null) return value
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function segmentToSVG(
  seg: VectorSegment,
  vertices: VectorVertex[],
  forward: boolean,
  decimals: number | null
): string {
  const start = forward ? vertices[seg.start] : vertices[seg.end]
  const end = forward ? vertices[seg.end] : vertices[seg.start]
  const ts = forward ? seg.tangentStart : { x: -seg.tangentEnd.x, y: -seg.tangentEnd.y }
  const te = forward ? seg.tangentEnd : { x: -seg.tangentStart.x, y: -seg.tangentStart.y }

  const isStraight =
    Math.abs(ts.x) < 0.001 &&
    Math.abs(ts.y) < 0.001 &&
    Math.abs(te.x) < 0.001 &&
    Math.abs(te.y) < 0.001

  if (isStraight) {
    return `L${coordinate(end.x, decimals)} ${coordinate(end.y, decimals)}`
  }

  const cp1x = coordinate(start.x + ts.x, decimals)
  const cp1y = coordinate(start.y + ts.y, decimals)
  const cp2x = coordinate(end.x + te.x, decimals)
  const cp2y = coordinate(end.y + te.y, decimals)
  return `C${cp1x} ${cp1y} ${cp2x} ${cp2y} ${coordinate(end.x, decimals)} ${coordinate(end.y, decimals)}`
}

function traceOrderedSegments(
  segmentIndices: readonly number[],
  segments: VectorSegment[],
  vertices: VectorVertex[],
  decimals: number | null
): string {
  if (segmentIndices.length === 0) return ''
  const first = segments[segmentIndices[0]]
  const second = segmentIndices.length > 1 ? segments[segmentIndices[1]] : null
  // Start at the first segment endpoint that does not connect to the second segment.
  const secondConnectsStart = second?.start === first.start || second?.end === first.start
  const secondConnectsEnd = second?.start === first.end || second?.end === first.end
  const firstForward = !second || secondConnectsEnd || !secondConnectsStart
  const startIndex = firstForward ? first.start : first.end
  let currentIndex = startIndex
  const parts = [
    `M${coordinate(vertices[startIndex].x, decimals)} ${coordinate(vertices[startIndex].y, decimals)}`
  ]

  for (const segmentIndex of segmentIndices) {
    const segment = segments[segmentIndex]
    const isConnected = segment.start === currentIndex || segment.end === currentIndex
    const forward = segment.start === currentIndex || !isConnected
    if (!isConnected) {
      const segmentStart = forward ? segment.start : segment.end
      parts.push(
        `M${coordinate(vertices[segmentStart].x, decimals)} ${coordinate(vertices[segmentStart].y, decimals)}`
      )
    }
    parts.push(segmentToSVG(segment, vertices, forward, decimals))
    currentIndex = forward ? segment.end : segment.start
  }
  if (parts.length === segmentIndices.length + 1 && currentIndex === startIndex) parts.push('Z')
  return parts.join('')
}

type SegmentAdjacency = ReadonlyMap<number, readonly number[]>

function buildSegmentAdjacency(segments: VectorSegment[]): SegmentAdjacency {
  const adjacency = new Map<number, number[]>()
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]
    for (const vertexIndex of [segment.start, segment.end]) {
      const incidentSegments = adjacency.get(vertexIndex)
      if (incidentSegments) incidentSegments.push(index)
      else adjacency.set(vertexIndex, [index])
    }
  }
  return adjacency
}

function findConnectedSegment(
  remaining: ReadonlySet<number>,
  adjacency: SegmentAdjacency,
  vertexIndex: number
): number | undefined {
  return adjacency.get(vertexIndex)?.find((index) => remaining.has(index))
}

function extendSegmentChain(
  chain: number[],
  startVertex: number,
  remaining: Set<number>,
  segments: VectorSegment[],
  adjacency: SegmentAdjacency
): void {
  let currentIndex = startVertex
  let nextIndex = findConnectedSegment(remaining, adjacency, currentIndex)
  while (nextIndex !== undefined) {
    chain.push(nextIndex)
    remaining.delete(nextIndex)
    const segment = segments[nextIndex]
    currentIndex = segment.start === currentIndex ? segment.end : segment.start
    nextIndex = findConnectedSegment(remaining, adjacency, currentIndex)
  }
}

function unfilledSegmentsToPath(network: VectorNetwork, decimals: number | null): string {
  const { vertices, segments } = network
  const remaining = new Set(segments.map((_, index) => index))
  const adjacency = buildSegmentAdjacency(segments)
  const parts: string[] = []

  while (remaining.size > 0) {
    const firstIndex = remaining.values().next().value
    if (firstIndex === undefined) break
    remaining.delete(firstIndex)
    const first = segments[firstIndex]

    const backward: number[] = []
    extendSegmentChain(backward, first.start, remaining, segments, adjacency)
    backward.reverse()

    const forward: number[] = []
    extendSegmentChain(forward, first.end, remaining, segments, adjacency)

    parts.push(
      traceOrderedSegments([...backward, firstIndex, ...forward], segments, vertices, decimals)
    )
  }

  return parts.join('')
}

export function vectorNetworkToSVGPaths(
  network: VectorNetwork,
  decimals: number | null = 2
): string[] {
  const { vertices, regions } = network

  if (regions.length === 0) {
    const path = unfilledSegmentsToPath(network, decimals)
    return path ? [path] : []
  }
  const paths = regionSVGPaths(network, decimals)
  // Segments no region encloses, such as an icon's open strokes beside its filled shapes,
  // draw as open paths after the regions.
  const open = looseSegments(network)
  const loose =
    open.length > 0 && unfilledSegmentsToPath({ vertices, segments: open, regions: [] }, decimals)
  return loose ? [...paths, loose] : paths
}

/** Each region of a vector network as path data, its loops traced in turn. */
export function regionSVGPaths(network: VectorNetwork, decimals: number | null = 2): string[] {
  const { vertices, segments, regions } = network
  return regions.map((region) =>
    region.loops.map((loop) => traceOrderedSegments(loop, segments, vertices, decimals)).join('')
  )
}

/** The segments of a vector network that no region encloses. */
export function looseSegments({ segments, regions }: VectorNetwork): VectorNetwork['segments'] {
  const enclosed = new Set(regions.flatMap((region) => region.loops.flat()))
  return segments.filter((_, index) => !enclosed.has(index))
}

/** A path of a vector network as Figma's `vectorPaths` gives it. */
export interface VectorPath {
  windingRule: VectorPathWindingRule
  data: string
}

/**
 * A vector network as Figma's `vectorPaths`: each region as a path with its winding rule, then
 * the segments no region encloses as one open path, at full precision.
 */
export function vectorNetworkPaths(network: VectorNetwork): VectorPath[] {
  if (network.segments.length === 0) return []
  const paths: VectorPath[] = regionSVGPaths(network, null).flatMap((data, index) =>
    data ? [{ windingRule: network.regions[index].windingRule, data }] : []
  )
  const open = looseSegments(network)
  if (open.length === 0) return paths
  const data = vectorNetworkToSVGPaths(
    { vertices: network.vertices, segments: open, regions: [] },
    null
  ).join('')
  return data ? [...paths, { windingRule: 'NONE', data }] : paths
}
