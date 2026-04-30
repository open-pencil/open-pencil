import type { VectorNetwork, VectorRegion, VectorSegment, VectorVertex } from '#core/scene-graph'

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
