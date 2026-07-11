import type { SceneGraph, SceneNode, VectorNetwork } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { computeAccurateBounds } from '#core/vector'

import type { SVGVectorizeResult } from './svg/to-vectors'

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

/** Fit vector geometry to node-local coordinates and a tight width/height (pen-tool pattern). */
function normalizeVectorToNodeBounds(network: VectorNetwork): {
  network: VectorNetwork
  bounds: Rect
} | null {
  const bounds = computeAccurateBounds(network)
  if (bounds.width <= 0 || bounds.height <= 0) return null

  return {
    bounds,
    network: {
      vertices: network.vertices.map((vertex) => ({
        ...vertex,
        x: vertex.x - bounds.x,
        y: vertex.y - bounds.y
      })),
      segments: network.segments,
      regions: network.regions
    }
  }
}

export function createVectorFrameChildren(
  graph: SceneGraph,
  frameId: string,
  vectorized: SVGVectorizeResult,
  placement: VectorFramePlacement
): void {
  for (const [index, path] of vectorized.paths.entries()) {
    const inFrame = offsetVectorNetwork(path.vectorNetwork, placement.offsetX, placement.offsetY)
    const normalized = normalizeVectorToNodeBounds(inFrame)
    if (!normalized) continue

    graph.createNode('VECTOR', frameId, {
      name: `path ${index + 1}`,
      x: normalized.bounds.x,
      y: normalized.bounds.y,
      width: normalized.bounds.width,
      height: normalized.bounds.height,
      vectorNetwork: normalized.network,
      fills: path.fills,
      strokes: path.strokes
    })
  }
}
