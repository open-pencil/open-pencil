import { mapValues } from 'es-toolkit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { remapInstanceOverrideState } from '@open-pencil/scene-graph/instances/overrides'

function remappedReferences(
  node: SceneNode,
  mapped: (id: string) => string,
  swapProperties: ReadonlySet<string>
): Partial<SceneNode> {
  const changes: Partial<SceneNode> = {}
  if (node.componentId && mapped(node.componentId) !== node.componentId)
    changes.componentId = mapped(node.componentId)
  const overrides = node.instanceOverrides
  if (overrides.self.size > 0 || overrides.descendants.size > 0) {
    changes.instanceOverrides = remapInstanceOverrideState(overrides, {
      node: mapped,
      variable: (id) => id
    })
  }
  if (node.componentPropertyDefinitions.some((definition) => definition.type === 'INSTANCE_SWAP')) {
    changes.componentPropertyDefinitions = node.componentPropertyDefinitions.map((definition) =>
      definition.type === 'INSTANCE_SWAP' && definition.defaultValue
        ? { ...definition, defaultValue: mapped(definition.defaultValue) }
        : definition
    )
  }
  if (Object.keys(node.componentPropertyAssignments).some((id) => swapProperties.has(id))) {
    changes.componentPropertyAssignments = mapValues(
      node.componentPropertyAssignments,
      (value, id) => (swapProperties.has(id) ? mapped(value) : value)
    )
  }
  return changes
}

/**
 * Points the layers a library copy made at one another, as `prepareNodeTransfer` does for a
 * paste: an instance's main component, the layers its overrides change and the components they
 * swap in, and the components an instance-swap property defaults to or is set to. `mappedIds`
 * maps each copied layer to its copy; a reference outside the copy stays as it is, and so do
 * variable IDs, since the copies keep their source's variables.
 */
export function remapCopiedReferences(
  graph: SceneGraph,
  mappedIds: ReadonlyMap<string, string>
): void {
  const mapped = (id: string) => mappedIds.get(id) ?? id
  const copies = [...mappedIds.values()].flatMap((id) => graph.getNode(id) ?? [])
  const swapProperties = new Set(
    copies.flatMap((node) =>
      node.componentPropertyDefinitions
        .filter((definition) => definition.type === 'INSTANCE_SWAP')
        .map((definition) => definition.id)
    )
  )
  for (const node of copies) {
    const changes = remappedReferences(node, mapped, swapProperties)
    if (Object.keys(changes).length > 0) graph.updateNode(node.id, changes)
  }
}
