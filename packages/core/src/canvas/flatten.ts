import type { Path } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode, VectorNetwork } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix } from '@open-pencil/scene-graph/coordinate'
import { copyFills } from '@open-pencil/scene-graph/copy'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'
import { mergeVectorNetworks } from '@open-pencil/scene-graph/vector-network'

import { makeBooleanSourcePath, placedPath, windingRuleOf } from './boolean'
import type { SkiaRenderer } from './renderer'

export type VectorFlattenProps = Pick<
  SceneNode,
  'name' | 'x' | 'y' | 'width' | 'height' | 'fills' | 'vectorNetwork'
>

type NodePathFactory = (
  renderer: SkiaRenderer,
  graph: SceneGraph,
  node: SceneNode
) => ReturnType<typeof makeBooleanSourcePath>

function nodesToVectorProps(
  renderer: SkiaRenderer,
  graph: SceneGraph,
  nodes: SceneNode[],
  makeNodePath: NodePathFactory
): VectorFlattenProps | null {
  const placed: Path[] = []
  try {
    for (const node of nodes) {
      const nodePath = makeNodePath(renderer, graph, node)
      if (!nodePath) return null
      placed.push(placedPath(renderer, nodePath, getNodeLocalMatrix(node)))
      nodePath.delete()
    }
    const drawn = placed.filter((path) => !path.isEmpty())
    const box = boundsOf(drawn)
    if (!box) return null
    return {
      name: 'Flatten',
      ...box,
      fills: copyFills(nodes[0].fills),
      vectorNetwork: mergeVectorNetworks(drawn.map((path) => networkIn(renderer, path, box)))
    }
  } finally {
    for (const path of placed) path.delete()
  }
}

function boundsOf(paths: Path[]): Rect | null {
  if (paths.length === 0) return null
  const all = paths.map((path) => path.getBounds())
  const left = Math.min(...all.map((bounds) => bounds[0]))
  const top = Math.min(...all.map((bounds) => bounds[1]))
  const right = Math.max(...all.map((bounds) => bounds[2]))
  const bottom = Math.max(...all.map((bounds) => bounds[3]))
  if (right <= left || bottom <= top) return null
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function networkIn(renderer: SkiaRenderer, path: Path, box: Vector): VectorNetwork {
  const moved = placedPath(renderer, path, renderer.ck.Matrix.translated(-box.x, -box.y))
  const network = parseSVGPath(moved.toSVGString(), windingRuleOf(renderer, moved))
  moved.delete()
  return network
}

export function flattenNodesToVectorProps(
  renderer: SkiaRenderer,
  graph: SceneGraph,
  nodes: SceneNode[]
): VectorFlattenProps | null {
  return nodesToVectorProps(renderer, graph, nodes, (r, g, node) =>
    makeBooleanSourcePath(r, node, g)
  )
}
