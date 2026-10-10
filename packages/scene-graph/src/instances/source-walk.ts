import type { SceneGraph } from '../'
import type { SceneNode } from '../types'
import { copyLayerId, instanceScope } from './layer-ids'

/**
 * Walk an instance's layers beside the component layers they copy. `visit` returns whether to
 * continue into that pair's children.
 */
export function walkInstanceSources(
  graph: SceneGraph,
  instance: SceneNode,
  visit: (source: SceneNode, target: SceneNode) => boolean
): void {
  if (instance.type !== 'INSTANCE' || !instance.componentId) return
  const component = graph.getNode(instance.componentId)
  if (!component) return
  const scope = instanceScope(instance)
  const walk = (sourceParent: SceneNode): void => {
    for (const sourceId of sourceParent.childIds) {
      const source = graph.getNode(sourceId)
      const target = source && graph.getNode(copyLayerId(scope, source))
      if (source && target && visit(source, target)) walk(source)
    }
  }
  walk(component)
}
