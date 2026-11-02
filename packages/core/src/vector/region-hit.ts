import type { VectorNetwork } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

/** How far, in network units, a flattened curve may stray from the curve unless a caller says. */
const DEFAULT_TOLERANCE = 0.25
/** Keeps a huge curve at a tiny tolerance from flattening into an unbounded number of points. */
const MAX_CURVE_STEPS = 1024

/**
 * Steps that keep a cubic's polyline within `tolerance` of it: equal steps in t stray at most
 * M / (8n²) from a curve whose second derivative is at most M, and for a cubic
 * M ≤ 6 · max(|p0 − 2p1 + p2|, |p1 − 2p2 + p3|).
 */
function curveSteps(p0: Vector, p1: Vector, p2: Vector, p3: Vector, tolerance: number): number {
  const bend = Math.max(
    Math.hypot(p0.x - 2 * p1.x + p2.x, p0.y - 2 * p1.y + p2.y),
    Math.hypot(p1.x - 2 * p2.x + p3.x, p1.y - 2 * p2.y + p3.y)
  )
  const steps = Math.ceil(Math.sqrt((6 * bend) / (8 * tolerance)))
  return Math.min(MAX_CURVE_STEPS, Math.max(1, steps))
}

/** Points along a segment, from its start to its end, in network coordinates. */
function segmentPoints(network: VectorNetwork, index: number, tolerance: number): Vector[] | null {
  const segment = network.segments.at(index)
  if (!segment || segment.start < 0 || segment.end < 0) return null
  const p0 = network.vertices.at(segment.start)
  const p3 = network.vertices.at(segment.end)
  if (!p0 || !p3) return null
  const { tangentStart: a, tangentEnd: b } = segment
  if (a.x === 0 && a.y === 0 && b.x === 0 && b.y === 0) return [p0, p3]
  const p1 = { x: p0.x + a.x, y: p0.y + a.y }
  const p2 = { x: p3.x + b.x, y: p3.y + b.y }
  const points: Vector[] = []
  const steps = curveSteps(p0, p1, p2, p3, tolerance)
  for (let step = 0; step <= steps; step++) {
    const t = step / steps
    const u = 1 - t
    points.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
    })
  }
  return points
}

/**
 * A loop's points in the order it is walked. Segments in a loop can be stored either way round,
 * so each is followed from the vertex the previous one ended on.
 */
function loopPoints(network: VectorNetwork, loop: number[], tolerance: number): Vector[] {
  const { segments } = network
  const first = segments.at(loop[0] ?? -1)
  const second = segments.at(loop[1] ?? -1)
  if (!first) return []
  // Walk the first segment toward the vertex it shares with the next one.
  const firstForward = !second || first.end === second.start || first.end === second.end
  let current = firstForward ? first.start : first.end
  const points: Vector[] = []
  for (const index of loop) {
    const segment = segments.at(index)
    const along = segmentPoints(network, index, tolerance)
    if (!segment || !along) continue
    const forward = segment.start === current
    points.push(...(forward ? along : along.toReversed()))
    current = forward ? segment.end : segment.start
  }
  return points
}

/** The signed number of times the region's loops wind around `point`. */
function windingNumber(
  network: VectorNetwork,
  regionIndex: number,
  point: Vector,
  tolerance: number
): number {
  let winding = 0
  for (const loop of network.regions[regionIndex]?.loops ?? []) {
    const points = loopPoints(network, loop, tolerance)
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i]
      const b = points[i + 1]
      // Which side of the edge a→b the point is on, positive when left.
      const side = (b.x - a.x) * (point.y - a.y) - (point.x - a.x) * (b.y - a.y)
      if (a.y <= point.y) {
        if (b.y > point.y && side > 0) winding++
      } else if (b.y <= point.y && side < 0) {
        winding--
      }
    }
  }
  return winding
}

/**
 * The region of a vector network that contains `point`, as Figma finds the region under the
 * pointer in vector edit mode: each region's loops wind around the point by its own fill rule,
 * and where regions overlap the last one wins. Null outside every region. Curves are flattened
 * to within `tolerance` network units, so a point farther than that from an edge is placed
 * exactly.
 */
export function regionAtPoint(
  network: VectorNetwork,
  point: Vector,
  tolerance = DEFAULT_TOLERANCE
): number | null {
  for (let index = network.regions.length - 1; index >= 0; index--) {
    const winding = windingNumber(network, index, point, tolerance)
    const inside =
      network.regions[index].windingRule === 'EVENODD' ? winding % 2 !== 0 : winding !== 0
    if (inside) return index
  }
  return null
}

/** The vertices on a region's loops, which a selected region moves with it. */
export function regionVertexIndices(network: VectorNetwork, regionIndex: number): number[] {
  const indices = new Set<number>()
  for (const loop of network.regions.at(regionIndex)?.loops ?? []) {
    for (const index of loop) {
      const segment = network.segments.at(index)
      if (!segment) continue
      indices.add(segment.start)
      indices.add(segment.end)
    }
  }
  return [...indices]
}

/**
 * The distance between region hatch lines, in screen pixels at `zoom`: 8 at 100%, halving and
 * doubling between powers of two as Figma's does, so the stripes keep a steady density.
 */
export function regionHatchPeriod(zoom: number): number {
  if (!(zoom > 0)) return 8
  return (8 * zoom) / 2 ** Math.round(Math.log2(zoom))
}
