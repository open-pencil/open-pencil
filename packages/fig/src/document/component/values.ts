import type { SceneGraph } from '@open-pencil/scene-graph'

/** Convert source component references to canonical destination node identities. */
export function linkComponentPropertyValues(
  graph: SceneGraph,
  sources: ReadonlyMap<string, string>,
  existingNodeIds: ReadonlySet<string> = new Set()
): void {
  const definitions = new Map<string, string>()
  for (const node of graph.getAllNodes()) {
    for (const definition of node.componentPropertyDefinitions) {
      definitions.set(definition.id, definition.type)
      if (existingNodeIds.has(node.id) || definition.type !== 'INSTANCE_SWAP') continue
      const target = sources.get(definition.defaultValue)
      if (target) definition.defaultValue = target
    }
  }
  for (const node of graph.getAllNodes()) {
    if (existingNodeIds.has(node.id)) continue
    for (const [propertyId, value] of Object.entries(node.componentPropertyAssignments)) {
      if (definitions.get(propertyId) !== 'INSTANCE_SWAP') continue
      const target = sources.get(value)
      if (target) node.componentPropertyAssignments[propertyId] = target
    }
  }
}
