import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { computeAbsoluteBounds } from '@open-pencil/scene-graph/geometry'
import { deriveSlashVariantProperties } from '@open-pencil/scene-graph/variant-properties'

import { randomHex } from '#core/random'

const COMPONENT_SET_PADDING = 40

function requireDistinctComponents(graph: SceneGraph, nodeIds: ReadonlyArray<string>): SceneNode[] {
  if (nodeIds.length === 0) throw new Error('Need at least 1 component to combine as variants')
  if (new Set(nodeIds).size !== nodeIds.length) {
    throw new Error('combineAsVariants requires distinct COMPONENT nodes')
  }

  const nodes = nodeIds.map((id) => graph.getNode(id))
  if (!nodes.every((node): node is SceneNode => node?.type === 'COMPONENT')) {
    throw new Error('combineAsVariants requires COMPONENT nodes')
  }
  return nodes
}

export function combineComponentsAsVariants(
  graph: SceneGraph,
  nodeIds: ReadonlyArray<string>,
  parentId: string,
  index?: number
): SceneNode {
  const components = requireDistinctComponents(graph, nodeIds)
  const parent = graph.getNode(parentId)
  if (!parent) throw new Error('Parent node not found')

  const bounds = computeAbsoluteBounds(components, (id) => graph.getAbsolutePosition(id))
  const parentPosition =
    parentId === graph.rootId || parent.type === 'CANVAS'
      ? { x: 0, y: 0 }
      : graph.getAbsolutePosition(parentId)
  const componentSet = graph.createNode('COMPONENT_SET', parentId, {
    name: components[0].name.split('/')[0]?.trim() || 'Component Set',
    x: bounds.x - parentPosition.x - COMPONENT_SET_PADDING,
    y: bounds.y - parentPosition.y - COMPONENT_SET_PADDING,
    width: bounds.width + COMPONENT_SET_PADDING * 2,
    height: bounds.height + COMPONENT_SET_PADDING * 2,
    fills: [
      {
        type: 'SOLID',
        color: { r: 0.96, g: 0.96, b: 0.96, a: 1 },
        opacity: 1,
        visible: true
      }
    ]
  })

  for (const component of components) graph.reparentNode(component.id, componentSet.id)
  if (index !== undefined) graph.reorderChild(componentSet.id, parentId, index)

  const derived = deriveSlashVariantProperties(components, () => `prop:${randomHex(8)}`)
  if (derived) {
    for (const [nodeId, changes] of derived.variants) graph.updateNode(nodeId, changes)
    graph.updateNode(componentSet.id, { componentPropertyDefinitions: derived.definitions })
  }

  return componentSet
}
