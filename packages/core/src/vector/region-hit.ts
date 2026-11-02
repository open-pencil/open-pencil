import type { VectorNetwork } from '@open-pencil/scene-graph'
import { containsByWinding, loopPoints } from '@open-pencil/scene-graph/outline'
import type { Vector } from '@open-pencil/scene-graph/primitives'

/** How far, in network units, a flattened curve may stray from the curve unless a caller says. */
const DEFAULT_TOLERANCE = 0.25

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
    const region = network.regions[index]
    const loops = region.loops.map((loop) => loopPoints(network, loop, tolerance))
    if (containsByWinding(loops, region.windingRule, point)) return index
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
