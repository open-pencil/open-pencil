import { isEqual, mapValues } from 'es-toolkit'

import { componentPropertyDefinitions } from '../components/properties'
import type { SceneGraph } from '../graph'
import { remapInstanceOverrideState } from '../instances/overrides'
import type { ComponentPropertyDefinition, SceneNode } from '../types'

function swapPropertyIds(definitions: readonly ComponentPropertyDefinition[]): string[] {
  return definitions
    .filter((definition) => definition.type === 'INSTANCE_SWAP')
    .map((definition) => definition.id)
}

function remappedReferences(
  node: SceneNode,
  mapped: (id: string) => string,
  swapProperties: ReadonlySet<string>
): Partial<SceneNode> {
  const changes: Partial<SceneNode> = {}
  if (node.componentId && mapped(node.componentId) !== node.componentId)
    changes.componentId = mapped(node.componentId)
  // Only what a mapping changes: every write is an update collaboration sends.
  const overrides = remapInstanceOverrideState(node.instanceOverrides, {
    node: mapped,
    variable: (id) => id
  })
  if (!isEqual(overrides, node.instanceOverrides)) changes.instanceOverrides = overrides
  const definitions = node.componentPropertyDefinitions.map((definition) =>
    definition.type === 'INSTANCE_SWAP' && definition.defaultValue
      ? { ...definition, defaultValue: mapped(definition.defaultValue) }
      : definition
  )
  if (!isEqual(definitions, node.componentPropertyDefinitions))
    changes.componentPropertyDefinitions = definitions
  const assignments = mapValues(node.componentPropertyAssignments, (value, id) =>
    swapProperties.has(id) ? mapped(value) : value
  )
  if (!isEqual(assignments, node.componentPropertyAssignments))
    changes.componentPropertyAssignments = assignments
  for (const field of ['connectorStart', 'connectorEnd'] as const) {
    const endpoint = node[field]
    if (endpoint?.nodeId && mapped(endpoint.nodeId) !== endpoint.nodeId)
      changes[field] = { ...endpoint, nodeId: mapped(endpoint.nodeId) }
  }
  return changes
}

/**
 * Points copied layers at one another, as `prepareNodeTransfer` does for a paste: an instance's
 * main component, the layers its overrides change and the components they swap in, the
 * components an instance-swap property defaults to or is set to, and the layers a connector's
 * ends follow. `mappedIds` maps each copied layer to its copy, such as a library copy or a design
 * JSX render folded into the layers it replaces; a reference outside the copy stays as it is, and
 * so do variable IDs, since the copies keep their source's variables.
 */
export function remapCopiedReferences(
  graph: SceneGraph,
  mappedIds: ReadonlyMap<string, string>
): void {
  const mapped = (id: string) => mappedIds.get(id) ?? id
  const copies = [...mappedIds.values()].flatMap((id) => graph.getNode(id) ?? [])
  const copiedSwaps = copies.flatMap((node) => swapPropertyIds(node.componentPropertyDefinitions))
  for (const node of copies) {
    // An instance's swap property may be defined on a component the copy leaves behind.
    const swapProperties = new Set([
      ...copiedSwaps,
      ...swapPropertyIds(componentPropertyDefinitions(graph, node))
    ])
    const changes = remappedReferences(node, mapped, swapProperties)
    if (Object.keys(changes).length > 0) graph.updateNode(node.id, changes)
  }
}
