import type { SceneGraph, SceneNode, VectorNetwork } from '@open-pencil/core/scene-graph'
import type { SvgVectorizeResult } from '@open-pencil/core/tools'
import type { Rect } from '@open-pencil/core/types'

export interface VectorFramePlacement {
  x: number
  y: number
  width: number
  height: number
  offsetX: number
  offsetY: number
}

function shouldTightenToContent(node: Pick<SceneNode, 'width' | 'height'>, content: Rect): boolean {
  return (
    content.width > 0 &&
    content.height > 0 &&
    (content.x > 0 ||
      content.y > 0 ||
      content.width < node.width - 0.5 ||
      content.height < node.height - 0.5)
  )
}

export function resolveVectorFramePlacement(
  node: Pick<SceneNode, 'x' | 'y' | 'width' | 'height'>,
  content: Rect
): VectorFramePlacement {
  const tighten = shouldTightenToContent(node, content)
  const offsetX = tighten ? content.x : 0
  const offsetY = tighten ? content.y : 0
  return {
    x: node.x + offsetX,
    y: node.y + offsetY,
    width: tighten ? content.width : node.width,
    height: tighten ? content.height : node.height,
    offsetX,
    offsetY
  }
}

function offsetVectorNetwork(
  network: VectorNetwork,
  offsetX: number,
  offsetY: number
): VectorNetwork {
  if (offsetX === 0 && offsetY === 0) return network
  return {
    vertices: network.vertices.map((vertex) => ({
      ...vertex,
      x: vertex.x - offsetX,
      y: vertex.y - offsetY
    })),
    segments: network.segments,
    regions: network.regions
  }
}

export function createVectorFrameChildren(
  graph: SceneGraph,
  frameId: string,
  vectorized: SvgVectorizeResult,
  placement: VectorFramePlacement
): void {
  for (const [index, path] of vectorized.paths.entries()) {
    graph.createNode('VECTOR', frameId, {
      name: `path ${index + 1}`,
      x: 0,
      y: 0,
      width: placement.width,
      height: placement.height,
      vectorNetwork: offsetVectorNetwork(
        path.vectorNetwork,
        placement.offsetX,
        placement.offsetY
      ),
      fills: path.fills,
      strokes: path.strokes
    })
  }
}