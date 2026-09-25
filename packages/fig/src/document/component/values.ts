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
    // for-in skips the entry array that most nodes, which assign nothing, never need.
    for (const propertyId in node.componentPropertyAssignments) {
      if (definitions.get(propertyId) !== 'INSTANCE_SWAP') continue
      const target = sources.get(node.componentPropertyAssignments[propertyId])
      if (target) node.componentPropertyAssignments[propertyId] = target
    }
  }
}

/**
 * A variant's saved specs name the component set's variant definitions by id. Its own
 * definitions never include those, so the names resolve only once the set is materialized.
 */
export function resolveVariantPropertyValues(
  graph: SceneGraph,
  existingNodeIds: ReadonlySet<string> = new Set()
): void {
  for (const node of graph.getAllNodes()) {
    if (existingNodeIds.has(node.id) || node.type !== 'COMPONENT' || !node.parentId) continue
    if (node.variantPropSpecs.length === 0) continue
    const parent = graph.getNode(node.parentId)
    if (parent?.type !== 'COMPONENT_SET') continue
    const names = new Map(parent.componentPropertyDefinitions.map((def) => [def.id, def.name]))
    const values: Record<string, string> = {}
    for (const spec of node.variantPropSpecs)
      values[names.get(spec.propDefId) ?? spec.propDefId] = spec.value
    graph.updateNode(node.id, { componentPropertyValues: values })
  }
}
