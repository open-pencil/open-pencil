import type { SceneGraph } from '../'

/** Whether placing this definition's instance would introduce a component dependency cycle. */
export function canCreateInstance(
  graph: SceneGraph,
  componentId: string,
  parentId: string
): boolean {
  if (graph.getNode(componentId)?.type !== 'COMPONENT') return false
  const ancestors = new Set<string>()
  let parent = graph.getNode(parentId)
  while (parent) {
    if (parent.type === 'COMPONENT') ancestors.add(parent.id)
    parent = parent.parentId ? graph.getNode(parent.parentId) : undefined
  }
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
