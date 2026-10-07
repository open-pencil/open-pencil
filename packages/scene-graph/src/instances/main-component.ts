import type { SceneGraph } from '../index'
import type { SceneNode } from '../types'

/**
 * The main component an instance shows. An instance nested in another instance points at the
 * instance it was cloned from, so follow those links to the component.
 */
export function instanceMainComponent(
  graph: SceneGraph,
  instance: SceneNode
): SceneNode | undefined {
  const seen = new Set<string>()
  let current = instance.componentId ? graph.getNode(instance.componentId) : undefined
  while (current?.type === 'INSTANCE' && current.componentId && !seen.has(current.id)) {
    seen.add(current.id)
    current = graph.getNode(current.componentId)
  }
  return current?.type === 'COMPONENT' ? current : undefined
}
