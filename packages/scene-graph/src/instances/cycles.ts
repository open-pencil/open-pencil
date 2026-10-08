import type { SceneGraph } from '../'
import { instanceMainComponent } from './main-component'

/**
 * Whether placing this definition's instance under `parentId` would make a component contain
 * itself. Both components and instances above the parent count: an instance's layers are its
 * component's, so a swap inside one may not bring that component back in.
 */
export function canCreateInstance(
  graph: SceneGraph,
  componentId: string,
  parentId: string
): boolean {
  if (graph.getNode(componentId)?.type !== 'COMPONENT') return false
  const ancestors = new Set<string>()
  graph.closest(parentId, (node) => {
    if (node.type === 'COMPONENT') ancestors.add(node.id)
    if (node.type === 'INSTANCE') {
      const main = instanceMainComponent(graph, node)
      if (main) ancestors.add(main.id)
    }
    return false
  })
  const visited = new Set<string>()
  function reachesAncestor(id: string): boolean {
    if (ancestors.has(id)) return true
    if (visited.has(id)) return false
    visited.add(id)
    const node = graph.getNode(id)
    if (!node) return false
    if (node.type === 'INSTANCE' && node.componentId && reachesAncestor(node.componentId))
      return true
    return node.childIds.some(reachesAncestor)
  }
  return !reachesAncestor(componentId)
}
