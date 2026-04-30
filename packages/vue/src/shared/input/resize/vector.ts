import type { SceneNode } from '@open-pencil/core/scene-graph'

type VectorNetwork = NonNullable<SceneNode['vectorNetwork']>

export function scaleVectorNetworkForResize(
  vectorNetwork: VectorNetwork | null,
  origWidth: number,
  origHeight: number,
  width: number,
  height: number
): VectorNetwork | null {
  if (!vectorNetwork || origWidth <= 0 || origHeight <= 0) return null

  const sx = width / origWidth
  const sy = height / origHeight
  if (sx === 1 && sy === 1) return null

  return {
    vertices: vectorNetwork.vertices.map((vertex) => ({
      ...vertex,
      x: vertex.x * sx,
      y: vertex.y * sy
    })),
    segments: vectorNetwork.segments.map((segment) => ({
      ...segment,
      tangentStart: {
        x: segment.tangentStart.x * sx,
        y: segment.tangentStart.y * sy
      },
      tangentEnd: {
        x: segment.tangentEnd.x * sx,
        y: segment.tangentEnd.y * sy
      }
    })),
    regions: vectorNetwork.regions
  }
}
