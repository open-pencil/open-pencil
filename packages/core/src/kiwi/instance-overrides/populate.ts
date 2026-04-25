import type { SceneGraph } from '../../scene-graph'

/**
 * Populate empty INSTANCE nodes from their source components.
 *
 * Instances must be populated bottom-up: if an instance's source is
 * itself an unpopulated instance, populate the source first so cloned
 * children are complete.
 */
function collectSubtreeIds(graph: SceneGraph, rootIds: Iterable<string>): Set<string> {
  const result = new Set<string>()
  const queue = [...rootIds]
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    if (result.has(id)) continue
    result.add(id)
    const node = graph.getNode(id)
    if (node) queue.push(...node.childIds)
  }
  return result
}

export function populateInstances(
  graph: SceneGraph,
  rootIds?: Iterable<string>
): Set<string> | undefined {
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

  if (!rootIds) {
    for (const node of graph.nodes.values()) {
      if (node.type === 'INSTANCE' && node.componentId && node.childIds.length === 0) {
        ensurePopulated(node.id)
      }
    }
    return undefined
  }

  const queue = [...rootIds]
  const visited = new Set<string>()
  while (queue.length > 0) {
    const nodeId = queue.shift()
    if (!nodeId || visited.has(nodeId)) continue
    visited.add(nodeId)
    ensurePopulated(nodeId)
    const node = graph.getNode(nodeId)
    if (!node) continue
    queue.push(...node.childIds)
  }
  return collectSubtreeIds(graph, rootIds)
}
