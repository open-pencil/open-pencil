import type { GeometryPath, SceneGraph, SceneNode, VectorNetwork } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { computeAccurateBounds } from '#core/vector/curve-math'
import { regenerateFillGeometry } from '#core/vector/fill-geometry'
import { mergeVectorNetworks } from '#core/vector/merge'

import type { SVGVectorizeResult, VectorizedPath } from './svg/to-vectors'

export interface CreateVectorFrameChildrenOptions {
  /** Merge fill-only paths into a single multi-color vector (SVG import). */
  flattenFills?: boolean
  /** Name for the flattened vector. */
  name?: string
}

export interface VectorFramePlacement {
  x: number
  y: number
  width: number
  height: number
  offsetX: number
  offsetY: number
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
function normalizeVectorToNodeBounds(network: VectorNetwork): {
  network: VectorNetwork
  bounds: Rect
} | null {
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

/**
 * Fill-only paths become ONE multi-color vector: a single merged network whose
 * regions carry per-path fills. That is the representation Figma uses for the
 * same artwork (per-path fills through fillGeometry, #388), so double-click
 * editing shows the whole illustration's anchors in one session and per-path
 * colors round-trip. Stroked paths can't participate — the flattened model has
 * no per-path strokes — so they stay separate sibling nodes.
 */
function createFlattenedVectorChild(
  graph: SceneGraph,
  frameId: string,
  paths: VectorizedPath[],
  placement: VectorFramePlacement,
  name: string
): SceneNode | null {
  const networks = paths.map((path) =>
    offsetVectorNetwork(path.vectorNetwork, placement.offsetX, placement.offsetY)
  )
  const normalized = normalizeVectorToNodeBounds(mergeVectorNetworks(networks))
  if (!normalized) return null

  // One fillGeometry entry per region, carrying its source path's fill; the
  // command blobs are rebuilt from the merged network by regenerateFillGeometry.
  const placeholders: GeometryPath[] = []
  networks.forEach((network, index) => {
    for (const region of network.regions) {
      placeholders.push({
        windingRule: region.windingRule,
        commandsBlob: new Uint8Array(0),
        ...(paths[index].fills.length > 0 ? { fills: paths[index].fills } : {})
      })
    }
  })

  return graph.createNode('VECTOR', frameId, {
    name,
    x: normalized.bounds.x,
    y: normalized.bounds.y,
    width: normalized.bounds.width,
    height: normalized.bounds.height,
    vectorNetwork: normalized.network,
    fillGeometry: regenerateFillGeometry(normalized.network, placeholders),
    fills: paths.find((path) => path.fills.length > 0)?.fills ?? []
  })
}

export function createVectorFrameChildren(
  graph: SceneGraph,
  frameId: string,
  vectorized: SVGVectorizeResult,
  placement: VectorFramePlacement,
  options: CreateVectorFrameChildrenOptions = {}
): void {
  // Bitmap vectorization keeps one node per traced path; only SVG import opts
  // into the flattened multi-color representation.
  // Requires a closed region: an open chain contributes no fillGeometry entry,
  // so merging it in would leave its geometry in the network but unpainted.
  const flattenable = options.flattenFills
    ? vectorized.paths.filter(
        (path) =>
          path.strokes.length === 0 &&
          path.fills.length > 0 &&
          path.vectorNetwork.regions.length > 0
      )
    : []
  const flatten = flattenable.length > 1
  if (flatten) {
    createFlattenedVectorChild(graph, frameId, flattenable, placement, options.name ?? 'Vector')
  }
  const remaining = flatten
    ? vectorized.paths.filter((path) => !flattenable.includes(path))
    : vectorized.paths

  for (const [index, path] of remaining.entries()) {
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
