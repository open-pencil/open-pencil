import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

function layers(graph: SceneGraph, id: string): SceneNode[] {
  const found: SceneNode[] = []
  const queue = [...graph.getChildren(id)]
  for (const node of queue) {
    found.push(node)
    for (const child of graph.getChildren(node.id)) queue.push(child)
  }
  return found
}

/** The copy in an instance made, through copies of copies, from the pen.dev layer `sourceId`. */
export function copyOf(graph: SceneGraph, instanceId: string, sourceId: string): SceneNode {
  const madeFrom = (node: SceneNode): boolean => {
    for (let id = node.componentId; id; id = graph.getNode(id)?.componentId ?? null) {
      if (id === sourceId) return true
    }
    return false
  }
  return expectDefined(layers(graph, instanceId).find(madeFrom), `${sourceId} in ${instanceId}`)
}
