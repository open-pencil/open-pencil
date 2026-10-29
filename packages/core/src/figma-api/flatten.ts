import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { copyFills } from '@open-pencil/scene-graph/copy'

import type { SkiaRenderer } from '#core/canvas'
import { canMakeBooleanSourceNode } from '#core/canvas/boolean'
import { flattenNodesToVectorProps } from '#core/canvas/flatten'

/** Without a renderer there are no outlines to merge: the first layer's box stands in. */
function flattenPlaceholder(graph: SceneGraph, nodes: SceneNode[], parentId: string): SceneNode {
  const first = nodes[0]
  return graph.createNode('VECTOR', parentId, {
    name: 'Flatten',
    x: first.x,
    y: first.y,
    width: first.width,
    height: first.height,
    fills: copyFills(first.fills)
  })
}

/** The vector `flatten` makes from `nodes` in `parentId`, before the sources are removed. */
export function flattenSceneNodes(
  graph: SceneGraph,
  renderer: SkiaRenderer | null,
  nodes: SceneNode[],
  parentId: string
): SceneNode {
  if (!renderer) return flattenPlaceholder(graph, nodes, parentId)
  if (nodes.some((node) => !canMakeBooleanSourceNode(node, graph))) {
    throw new Error('Cannot flatten unsupported node type')
  }
  const vectorProps = flattenNodesToVectorProps(renderer, graph, nodes)
  if (!vectorProps) throw new Error('Cannot flatten empty node path')
  return graph.createNode('VECTOR', parentId, vectorProps)
}
