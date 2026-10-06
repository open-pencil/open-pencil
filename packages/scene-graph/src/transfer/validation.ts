import type { SceneGraph } from '../index'
import { createDefaultNode } from '../node-defaults'
import type { ComponentPropertyType } from '../types'
import type { GraphTransferPlan } from './apply'
import { variableIdentityReferences } from './identity'
import { prepareNodeTransfer } from './nodes'

/** Revalidate mutable plan references without allocating or registering destination nodes. */
export function validateTransferReferences(target: SceneGraph, plan: GraphTransferPlan): void {
  const nodes = new Map(
    plan.nodes.map((entry) => [
      entry.id,
      createDefaultNode(() => entry.id, entry.type, entry.props)
    ])
  )
  const identities = new Map([...nodes.keys()].map((id) => [id, id]))
  const properties = new Map<string, string>()
  const propertyTypes = new Map<string, ComponentPropertyType>()
  for (const node of nodes.values())
    for (const definition of node.componentPropertyDefinitions) {
      const previous = propertyTypes.get(definition.id)
      if (previous && previous !== definition.type)
        throw new Error(`Conflicting transfer property ${definition.id}`)
      properties.set(definition.id, definition.id)
      propertyTypes.set(definition.id, definition.type)
    }
  const collections = new Map(plan.collections.map((collection) => [collection.id, collection]))
  const references = {
    nodes: identities,
    styles: identities,
    properties,
    propertyTypes,
    ...variableIdentityReferences(plan.variables, plan.collections)
  }
  for (const node of nodes.values()) {
    prepareNodeTransfer(node, references)
    for (const [collection, mode] of Object.entries(node.variableModes)) {
      if (!collections.get(collection)?.modes.some((entry) => entry.modeId === mode))
        throw new Error(`Invalid node variable mode ${node.id}`)
    }
  }
  const roots = new Set([...plan.rootIds, ...plan.dependencyPageIds])
  if (roots.size !== plan.rootIds.length + plan.dependencyPageIds.length)
    throw new Error('Repeated transfer root')
  for (const entry of plan.nodes) {
    if (roots.has(entry.id) === nodes.has(entry.parentId))
      throw new Error(`Invalid transfer root topology ${entry.id}`)
    if (
      plan.dependencyPageIds.includes(entry.id) &&
      (entry.type !== 'CANVAS' || !entry.props.internalOnly || entry.parentId !== target.rootId)
    )
      throw new Error(`Invalid transfer dependency page ${entry.id}`)
  }
}
