import type {
  Fill,
  GeometryPath,
  SceneGraph,
  SceneNode,
  VectorNetwork
} from '@open-pencil/scene-graph'
import { mergeVectorNetworks } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { computeAccurateBounds } from '#core/vector/curve-math'
import { regenerateFillGeometry } from '#core/vector/fill-geometry'

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

type VectorChildPaints = Pick<SceneNode, 'fillGeometry' | 'fills' | 'strokes'>

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

function createNormalizedVectorChild(
  graph: SceneGraph,
  frameId: string,
  normalized: NormalizedVectorGeometry,
  index: number,
  paints: VectorChildPaints
): void {
  graph.createNode('VECTOR', frameId, {
    name: `path ${index + 1}`,
    x: normalized.bounds.x,
    y: normalized.bounds.y,
    width: normalized.bounds.width,
    height: normalized.bounds.height,
    vectorNetwork: normalized.network,
    ...paints
  })
}

function createVectorChild(
  graph: SceneGraph,
  frameId: string,
  path: VectorizedPath,
  placement: VectorFramePlacement,
  index: number
): void {
  const inFrame = offsetVectorNetwork(path.vectorNetwork, placement.offsetX, placement.offsetY)
  const normalized = normalizeVectorToNodeBounds(inFrame)
  if (!normalized) return
  createNormalizedVectorChild(graph, frameId, normalized, index, {
    fillGeometry: [],
    fills: path.fills,
    strokes: path.strokes
  })
}

function remapFillsToBounds(fills: Fill[], source: Rect, target: Rect): Fill[] {
  return structuredClone(fills).map((fill) => {
    const transform = fill.gradientTransform
    if (
      !transform ||
      source.width <= 0 ||
      source.height <= 0 ||
      target.width <= 0 ||
      target.height <= 0
    ) {
      return fill
    }
    const scaleX = source.width / target.width
    const scaleY = source.height / target.height
    return {
      ...fill,
      gradientTransform: {
        m00: transform.m00 * scaleX,
        m01: transform.m01 * scaleX,
        m02: (source.x - target.x) / target.width + transform.m02 * scaleX,
        m10: transform.m10 * scaleY,
        m11: transform.m11 * scaleY,
        m12: (source.y - target.y) / target.height + transform.m12 * scaleY
      }
    }
  })
}

function createFlattenedVectorChild(
  graph: SceneGraph,
  frameId: string,
  paths: VectorizedPath[],
  placement: VectorFramePlacement,
  index: number
): void {
  const prepared = paths.map((path) => {
    const network = offsetVectorNetwork(path.vectorNetwork, placement.offsetX, placement.offsetY)
    return { path, network, bounds: computeAccurateBounds(network) }
  })
  const normalized = normalizeVectorToNodeBounds(
    mergeVectorNetworks(prepared.map(({ network }) => network))
  )
  if (!normalized) return

  const placeholders: GeometryPath[] = prepared.flatMap(({ path, network, bounds }) => {
    const fills = remapFillsToBounds(path.fills, bounds, normalized.bounds)
    return network.regions.map((region) => ({
      windingRule: region.windingRule,
      commandsBlob: new Uint8Array(0),
      fills: structuredClone(fills)
    }))
  })
  const fills = prepared[0]
    ? remapFillsToBounds(prepared[0].path.fills, prepared[0].bounds, normalized.bounds)
    : []

  createNormalizedVectorChild(graph, frameId, normalized, index, {
    fillGeometry: regenerateFillGeometry(normalized.network, placeholders),
    fills,
    strokes: []
  })
}

export function createVectorFrameChildren(
  graph: SceneGraph,
  frameId: string,
  vectorized: SVGVectorizeResult,
  placement: VectorFramePlacement
): void {
  for (const [index, path] of vectorized.paths.entries()) {
    createVectorChild(graph, frameId, path, placement, index)
  }
}

function isFlattenableVectorPath(path: VectorizedPath): boolean {
  return path.fills.length > 0 && path.strokes.length === 0 && path.vectorNetwork.regions.length > 0
}

/** Merge adjacent fill-only SVG paths without changing their paint order. */
export function createFlattenedVectorFrameChildren(
  graph: SceneGraph,
  frameId: string,
  vectorized: SVGVectorizeResult,
  placement: VectorFramePlacement
): void {
  let run: { path: VectorizedPath; index: number }[] = []
  const flush = () => {
    if (run.length > 1) {
      createFlattenedVectorChild(
        graph,
        frameId,
        run.map(({ path }) => path),
        placement,
        run[0].index
      )
    } else if (run[0]) {
      createVectorChild(graph, frameId, run[0].path, placement, run[0].index)
    }
    run = []
  }

  for (const [index, path] of vectorized.paths.entries()) {
    if (isFlattenableVectorPath(path)) {
      run.push({ path, index })
      continue
    }
    flush()
    createVectorChild(graph, frameId, path, placement, index)
  }
  flush()
}
