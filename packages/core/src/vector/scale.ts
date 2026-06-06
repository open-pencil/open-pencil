import type { VectorNetwork } from '#core/scene-graph'

/** Scale vertex positions and relative bezier handles by sx/sy. */
export function scaleVectorNetwork(network: VectorNetwork, sx: number, sy: number): VectorNetwork {
  return {
    vertices: network.vertices.map((vertex) => ({
      ...vertex,
      x: vertex.x * sx,
      y: vertex.y * sy
    })),
    segments: network.segments.map((segment) => ({
      ...segment,
      tangentStart: { x: segment.tangentStart.x * sx, y: segment.tangentStart.y * sy },
      tangentEnd: { x: segment.tangentEnd.x * sx, y: segment.tangentEnd.y * sy }
    })),
    regions: network.regions.map((region) => ({
      windingRule: region.windingRule,
      loops: region.loops.map((loop) => [...loop])
    }))
  }
}
