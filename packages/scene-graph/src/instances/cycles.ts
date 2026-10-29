import type { SceneGraph } from '../graph'
import { instanceMainComponent } from './main-component'

/** Components at or above `parentId`, counting the component each enclosing instance shows. */
function enclosingComponents(graph: SceneGraph, parentId: string): Set<string> {
  const ancestors = new Set<string>()
  graph.closest(parentId, (node) => {
    if (node.type === 'COMPONENT') ancestors.add(node.id)
    if (node.type === 'INSTANCE') {
      const main = instanceMainComponent(graph, node)
      if (main) ancestors.add(main.id)
    }
    return false
  })
  return ancestors
}

/**
 * Whether moving `nodeId` under `parentId` would make a component contain itself: its layers,
 * followed through instances into their components, reach a component at or above the parent.
 * Both components and instances above the parent count: an instance's layers are its
 * component's, so a swap inside one may not bring that component back in.
 */
export function createsComponentCycle(
  graph: SceneGraph,
  nodeId: string,
  parentId: string
): boolean {
  const ancestors = enclosingComponents(graph, parentId)
  if (ancestors.size === 0) return false
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
  return reachesAncestor(nodeId)
}

/** Whether placing this definition's instance under `parentId` would make a component contain itself. */
export function canCreateInstance(
  graph: SceneGraph,
  componentId: string,
  parentId: string
): boolean {
  if (graph.getNode(componentId)?.type !== 'COMPONENT') return false
  return !createsComponentCycle(graph, componentId, parentId)
}

/**
 * `parentId`, or its nearest ancestor that can hold these layers or instances of these
 * components without a component containing itself. Figma pastes an instance next to its own
 * component, not in it.
 */
export function cycleSafeParent(
  graph: SceneGraph,
  parentId: string,
  nodeIds: readonly string[]
): string {
  const safe = graph.closest(
    parentId,
    (node) =>
      // Climbing out of a variant passes its set, which holds only variants.
      (node.id === parentId || node.type !== 'COMPONENT_SET') &&
      nodeIds.every((id) => !createsComponentCycle(graph, id, node.id))
  )
  return safe?.id ?? parentId
}
