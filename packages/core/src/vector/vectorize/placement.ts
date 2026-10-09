import type { SceneGraph, SceneNode, VectorNetwork } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { pathStrokeLineStyle } from '#core/icons/path-style'
import { computeAccurateBounds } from '#core/vector/curve-math'

import type { SVGVectorizeResult, VectorizedPath } from './svg/to-vectors'

export interface VectorFramePlacement {
  x: number
  y: number
  width: number
  height: number
  offsetX: number
  offsetY: number
}

interface NormalizedVectorGeometry {
  network: VectorNetwork
  bounds: Rect
}

function shouldTightenToContent(
  node: Pick<SceneNode, 'width' | 'height' | 'rotation'>,
  content: Rect
): boolean {
  return (
    node.rotation === 0 &&
    content.width > 0 &&
    content.height > 0 &&
    (content.x > 0 ||
      content.y > 0 ||
      content.width < node.width - 0.5 ||
      content.height < node.height - 0.5)
  )
}

export function resolveVectorFramePlacement(
  node: Pick<SceneNode, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
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
function normalizeVectorToNodeBounds(network: VectorNetwork): NormalizedVectorGeometry | null {
  if (network.vertices.length === 0) return null
  const bounds = computeAccurateBounds(network)

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

/** A vector of this geometry, in its parent's coordinates and sized to it. */
export function createPlacedVector(
  graph: SceneGraph,
  parentId: string,
  network: VectorNetwork,
  props: Partial<SceneNode>
): SceneNode | null {
  const normalized = normalizeVectorToNodeBounds(network)
  if (!normalized) return null
  return graph.createNode('VECTOR', parentId, {
    x: normalized.bounds.x,
    y: normalized.bounds.y,
    width: normalized.bounds.width,
    height: normalized.bounds.height,
    vectorNetwork: normalized.network,
    ...props
  })
}

/** The paints and stroke line style a vectorized SVG path draws with. */
export function vectorizedPathPaints(
  path: VectorizedPath
): Pick<SceneNode, 'fillGeometry' | 'fills' | 'strokes'> &
  Partial<Pick<SceneNode, 'strokeCap' | 'strokeJoin'>> {
  const stroke = path.strokes.at(0)
  return {
    fillGeometry: [],
    fills: path.fills,
    strokes: path.strokes,
    ...(stroke ? pathStrokeLineStyle(stroke) : {})
  }
}

export function createVectorFrameChildren(
  graph: SceneGraph,
  frameId: string,
  vectorized: SVGVectorizeResult,
  placement: VectorFramePlacement
): void {
  for (const [index, path] of vectorized.paths.entries()) {
    createPlacedVector(
      graph,
      frameId,
      offsetVectorNetwork(path.vectorNetwork, placement.offsetX, placement.offsetY),
      { name: `path ${index + 1}`, ...vectorizedPathPaints(path) }
    )
  }
}
