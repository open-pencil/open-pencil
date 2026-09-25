import type { SceneGraph } from '../index'
import type { ComponentPropertyType, SceneNode } from '../types'
import { prepareNodeTransfer } from './nodes'
import { requireTransferReference } from './references'
import { prepareVariableTransfer } from './variables'

export interface GraphTransferInput {
  source: SceneGraph
  rootIds: readonly string[]
  dependencyPageIds: readonly string[]
  target: SceneGraph
  parentId: string
}

/** Preflight a self-contained fragment; allocation does not insert anything into the target. */
export function prepareGraphTransfer(input: GraphTransferInput) {
  const { source, target, parentId } = input
  if (!target.getNode(parentId)) throw new Error(`Missing transfer parent ${parentId}`)
  const reserved = new Set([
    ...target.nodes.keys(),
    ...target.variables.keys(),
    ...target.variableCollections.keys()
  ])
  for (const collection of target.variableCollections.values())
    for (const mode of collection.modes) reserved.add(mode.modeId)
  let sequence = 0
  const namespace = crypto.randomUUID()
  const allocate = (): string => {
    let id = `${namespace}:${sequence++}`
    while (reserved.has(id)) id = `${namespace}:${sequence++}`
    reserved.add(id)
    return id
  }
  const ordered: SceneNode[] = []
  const seen = new Set<string>()
  const visit = (id: string): void => {
    if (seen.has(id)) throw new Error(`Repeated transfer node ${id}`)
    const node = source.getNode(id)
    if (!node) throw new Error(`Missing transfer source ${id}`)
    seen.add(id)
    ordered.push(node)
    for (const child of node.childIds) visit(child)
  }
  for (const id of [...input.dependencyPageIds, ...input.rootIds]) visit(id)
  const nodes = new Map(ordered.map((node) => [node.id, allocate()]))
  const variables = new Map([...source.variables.keys()].map((id) => [id, allocate()]))
  const collections = new Map([...source.variableCollections.keys()].map((id) => [id, allocate()]))
  const modes = new Map<string, string>()
  for (const collection of source.variableCollections.values()) {
    for (const mode of collection.modes)
      if (!modes.has(mode.modeId)) modes.set(mode.modeId, allocate())
  }
  const properties = new Map<string, string>()
  const propertyTypes = new Map<string, ComponentPropertyType>()
  for (const node of ordered)
    for (const definition of node.componentPropertyDefinitions) {
      if (propertyTypes.has(definition.id) && propertyTypes.get(definition.id) !== definition.type)
        throw new Error(`Conflicting property type ${definition.id}`)
      propertyTypes.set(definition.id, definition.type)
      if (!properties.has(definition.id)) properties.set(definition.id, allocate())
    }
  const references = {
    nodes,
    variables,
    collections,
    modes,
    properties,
    propertyTypes,
    styles: nodes
  }
  const resources = prepareVariableTransfer(
    [...source.variables.values()],
    [...source.variableCollections.values()],
    references
  )
  const mapped = (id: string): string => {
    const value = nodes.get(id)
    if (!value) throw new Error(`Missing transfer node mapping ${id}`)
    return value
  }
  const roots = new Set(input.rootIds)
  const dependencies = new Set(input.dependencyPageIds)
  const destinationParent = (node: SceneNode): string => {
    if (roots.has(node.id)) return parentId
    if (dependencies.has(node.id)) return target.rootId
    return mapped(node.parentId ?? '')
  }
  return {
    nodeIds: nodes,
    rootIds: input.rootIds.map(mapped),
    dependencyPageIds: input.dependencyPageIds.map(mapped),
    nodes: ordered.map((node) => ({
      id: mapped(node.id),
      type: node.type,
      parentId: destinationParent(node),
      props: prepareNodeTransfer(node, references)
    })),
    ...resources,
    activeModes: new Map(
      [...source.activeMode].map(([collection, mode]) => [
        requireTransferReference(collections, collection, 'collection'),
        requireTransferReference(modes, mode, 'mode')
      ])
    ),
    images: new Map([...source.images].map(([hash, bytes]) => [hash, bytes.slice()]))
  }
}
