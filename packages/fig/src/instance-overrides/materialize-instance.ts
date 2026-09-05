import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { createDefaultSourceMetadata } from '@open-pencil/scene-graph/node-defaults'

import { nodeChangeToProps } from '../node-change'
import type { InstanceOccurrence } from './interpret'

export interface MaterializedInstance {
  root: SceneNode
  /** Occurrence object identity distinguishes repeated uses of a source node. */
  nodes: ReadonlyMap<InstanceOccurrence, SceneNode>
}

/**
 * Materialize an interpreted tree, without legacy population, sync, or layout.
 * Component IDs must refer to existing COMPONENT nodes in the destination graph.
 * Occurrence provenance stays in the returned map, not in fabricated FIG metadata.
 */
export function materializeInstance(
  graph: SceneGraph,
  parentId: string,
  occurrence: InstanceOccurrence,
  components: ReadonlyMap<string, string>,
  blobs: Uint8Array[] = []
): MaterializedInstance {
  if (!graph.getNode(parentId)) throw new Error('Missing materialization parent')
  const prepared = new Map<InstanceOccurrence, ReturnType<typeof nodeChangeToProps>>()
  const validate = (current: InstanceOccurrence): void => {
    if (prepared.has(current)) throw new Error('Repeated or cyclic instance occurrence')
    const converted = nodeChangeToProps(current.properties, blobs)
    if (converted.nodeType === 'DOCUMENT' || converted.nodeType === 'VARIABLE') {
      throw new Error(`Cannot materialize ${converted.nodeType} as an instance descendant`)
    }
    prepared.set(current, converted)
    if (current.mainComponentId !== null) {
      const id = components.get(current.mainComponentId)
      if (!id || graph.getNode(id)?.type !== 'COMPONENT') {
        throw new Error(`Missing materialized component ${current.mainComponentId}`)
      }
    }
    for (const child of current.children) validate(child)
  }
  validate(occurrence)
  const nodes = new Map<InstanceOccurrence, SceneNode>()
  const create = (current: InstanceOccurrence, parent: string): SceneNode => {
    const converted = prepared.get(current)
    if (!converted) throw new Error('Missing prepared occurrence')
    const { nodeType, ...props } = converted
    if (nodeType === 'DOCUMENT' || nodeType === 'VARIABLE') {
      throw new Error(`Cannot materialize ${nodeType} as an instance descendant`)
    }
    const node = graph.createNode(nodeType, parent, {
      ...props,
      componentId:
        current.mainComponentId === null ? null : components.get(current.mainComponentId),
      source: createDefaultSourceMetadata()
    })
    nodes.set(current, node)
    for (const child of current.children) create(child, node.id)
    return node
  }
  return { root: create(occurrence, parentId), nodes }
}
