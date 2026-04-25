import type { SceneGraph } from '../../scene-graph'

/**
 * Populate empty INSTANCE nodes from their source components.
 *
 * Instances must be populated bottom-up: if an instance's source is
 * itself an unpopulated instance, populate the source first so cloned
 * children are complete.
 */
export function populateInstances(graph: SceneGraph): void {
  const visiting = new Set<string>()

  function ensurePopulated(nodeId: string): void {
    const node = graph.getNode(nodeId)
    if (node?.type !== 'INSTANCE' || !node.componentId || node.childIds.length > 0) return
    if (visiting.has(nodeId)) return
    visiting.add(nodeId)

    const comp = graph.getNode(node.componentId)
    if (!comp) return

    if (comp.type === 'INSTANCE' && comp.componentId && comp.childIds.length === 0) {
      ensurePopulated(comp.id)
    }
    for (const childId of comp.childIds) {
      const child = graph.getNode(childId)
      if (child?.type === 'INSTANCE' && child.componentId && child.childIds.length === 0) {
        ensurePopulated(childId)
      }
    }

    if (comp.childIds.length > 0 && node.childIds.length === 0) {
      graph.populateInstanceChildren(nodeId, node.componentId)
    }
  }

  for (const node of graph.nodes.values()) {
    if (node.type === 'INSTANCE' && node.componentId && node.childIds.length === 0) {
      ensurePopulated(node.id)
    }
  }
}
