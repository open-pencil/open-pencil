import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { copyFills } from '@open-pencil/scene-graph/copy'

import { parseSVGPath } from '#core/io/formats/svg/parse-path'

import { makeBooleanSourcePath, makeStrokeOutlinePath, nodePathTransform } from './boolean'
import type { SkiaRenderer } from './renderer'

type VectorFlattenProps = Pick<
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
  const path = new renderer.ck.Path()
  for (const node of nodes) {
    const nodePath = makeNodePath(renderer, graph, node)
    if (!nodePath) {
      path.delete()
      return null
    }
    nodePath.transform(nodePathTransform(renderer, node))
    path.addPath(nodePath)
    nodePath.delete()
  }

  const bounds = path.getBounds()
  if (bounds[2] <= bounds[0] || bounds[3] <= bounds[1]) {
    path.delete()
    return null
  }

  path.transform(renderer.ck.Matrix.translated(-bounds[0], -bounds[1]))
  const vectorNetwork = parseSVGPath(path.toSVGString())
  path.delete()

  return {
    name: 'Flatten',
    x: bounds[0],
    y: bounds[1],
    width: bounds[2] - bounds[0],
    height: bounds[3] - bounds[1],
    fills: copyFills(nodes[0].fills),
    vectorNetwork
  }
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

export function outlineStrokeNodesToVectorProps(
  renderer: SkiaRenderer,
  graph: SceneGraph,
  nodes: SceneNode[]
): VectorFlattenProps | null {
  return nodesToVectorProps(renderer, graph, nodes, (r, g, node) =>
    makeStrokeOutlinePath(r, node, g)
  )
}
