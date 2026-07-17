import type {
  VectorNetwork,
  VectorRegion,
  VectorSegment,
  VectorVertex
} from '@open-pencil/scene-graph'

/** Concatenate vector networks into one, offsetting segment/vertex indices. */
export function mergeVectorNetworks(networks: VectorNetwork[]): VectorNetwork {
  const vertices: VectorVertex[] = []
  const segments: VectorSegment[] = []
  const regions: VectorRegion[] = []
  let vertexOffset = 0
  let segmentOffset = 0
  for (const network of networks) {
    for (const v of network.vertices) vertices.push({ ...v })
    for (const s of network.segments) {
      segments.push({
        ...s,
        start: s.start + vertexOffset,
        end: s.end + vertexOffset,
        tangentStart: { ...s.tangentStart },
        tangentEnd: { ...s.tangentEnd }
      })
    }
    const segmentBase = segmentOffset
    for (const r of network.regions) {
      regions.push({
        windingRule: r.windingRule,
        loops: r.loops.map((loop) => loop.map((i) => i + segmentBase))
      })
    }
    vertexOffset += network.vertices.length
    segmentOffset += network.segments.length
  }
  return { vertices, segments, regions }
}
