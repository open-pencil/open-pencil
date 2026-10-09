import type { SceneGraph } from '../index'
import type { SceneNode } from '../types'

/** The main component an instance shows, nested instances included. */
export function instanceMainComponent(
  graph: SceneGraph,
  instance: SceneNode
): SceneNode | undefined {
  const component = instance.componentId ? graph.getNode(instance.componentId) : undefined
  return component?.type === 'COMPONENT' ? component : undefined
}
