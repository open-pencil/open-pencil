import { isEqual } from 'es-toolkit/predicate'

import type { Mat3 } from './matrix'
import type { Vector } from './primitives'
import type { VectorNetwork, VectorSegment } from './types'

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
      regions.push({ windingRule: region.windingRule, loops })
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
    regions: vn.regions.map((r) => ({
      windingRule: r.windingRule,
      loops: r.loops.map((l) => [...l])
    }))
  }
}

/** Structural equality of two VectorNetworks (order-sensitive, exact values). */
export function vectorNetworksEqual(a: VectorNetwork, b: VectorNetwork): boolean {
  return (
    isEqual(a.vertices, b.vertices) &&
    isEqual(a.segments, b.segments) &&
    isEqual(a.regions, b.regions)
  )
}

/** Deep-copy a VectorNetwork, stripping any Vue Proxy wrappers. */
export function cloneVectorNetwork(vn: VectorNetwork): VectorNetwork {
  return {
    vertices: vn.vertices.map((v) => ({ ...v })),
    segments: vn.segments.map((s) => ({
      ...s,
      tangentStart: { ...s.tangentStart },
      tangentEnd: { ...s.tangentEnd }
    })),
    regions: vn.regions.map((r) => ({
      windingRule: r.windingRule,
      loops: r.loops.map((l) => [...l])
    }))
  }
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
  if (Array.isArray(value.regions)) {
    validateRegions(value.regions, value.segments.length, errors)
  } else {
    errors.push('regions must be an array')
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

function validateRegions(regions: unknown[], segmentCount: number, errors: string[]): void {
  for (let regionIndex = 0; regionIndex < regions.length; regionIndex++) {
    const region = regions[regionIndex]
    if (!isRecord(region) || !Array.isArray(region.loops)) {
      errors.push(`region[${regionIndex}]: loops must be an array`)
      continue
    }
    if (region.windingRule !== 'NONZERO' && region.windingRule !== 'EVENODD') {
      errors.push(`region[${regionIndex}]: windingRule must be NONZERO or EVENODD`)
    }
    validateRegionLoops(region.loops, regionIndex, segmentCount, errors)
  }
}

function validateRegionLoops(
  loops: unknown[],
  regionIndex: number,
  segmentCount: number,
  errors: string[]
): void {
  for (let loopIndex = 0; loopIndex < loops.length; loopIndex++) {
    const loop = loops[loopIndex]
    if (!Array.isArray(loop)) {
      errors.push(`region[${regionIndex}].loop[${loopIndex}] must be an array`)
      continue
    }
    for (const segmentIndex of loop) {
      if (!isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= segmentCount) {
        errors.push(
          `region[${regionIndex}].loop[${loopIndex}]: segment index ${String(segmentIndex)} out of range`
        )
      }
    }
  }
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

/**
 * Ensure every segment has tangentStart/tangentEnd.
 * Missing tangents default to {x:0, y:0} (straight line segments).
 * Use at system boundaries where input may come from JSON/MCP.
 */
export function normalizeVectorNetwork(vn: VectorNetwork): VectorNetwork {
  const ZERO: Vector = { x: 0, y: 0 }
  return {
    vertices: vn.vertices,
    segments: vn.segments.map((s) => ({
      start: s.start,
      end: s.end,
      tangentStart: (s as Partial<VectorSegment>).tangentStart ?? { ...ZERO },
      tangentEnd: (s as Partial<VectorSegment>).tangentEnd ?? { ...ZERO }
    })),
    regions: vn.regions
  }
}
