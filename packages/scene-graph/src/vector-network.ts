import { isEqual } from 'es-toolkit/predicate'

import type { Mat3 } from './matrix'
import type { Vector } from './primitives'
import type { VectorNetwork, VectorSegment } from './types'

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
export function validateVectorNetwork(vn: VectorNetwork): string[] {
  const errors: string[] = []
  if (!Array.isArray(vn.vertices)) {
    errors.push('vertices must be an array')
    return errors
  }
  if (!Array.isArray(vn.segments)) {
    errors.push('segments must be an array')
    return errors
  }
  if (!Array.isArray(vn.regions)) errors.push('regions must be an array')
  const vertexCount = vn.vertices.length
  for (let i = 0; i < vn.vertices.length; i++) {
    const v = vn.vertices[i]
    if (typeof v.x !== 'number' || typeof v.y !== 'number') {
      errors.push(`vertex[${i}]: x and y must be numbers`)
    }
  }
  for (let i = 0; i < vn.segments.length; i++) {
    const s = vn.segments[i]
    if (typeof s.start !== 'number' || typeof s.end !== 'number') {
      errors.push(`segment[${i}]: start and end must be numbers`)
    } else {
      if (s.start < 0 || s.start >= vertexCount)
        errors.push(`segment[${i}]: start index ${s.start} out of range`)
      if (s.end < 0 || s.end >= vertexCount)
        errors.push(`segment[${i}]: end index ${s.end} out of range`)
    }
  }
  return errors
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
