import type { SceneGraph } from '../graph'
import type { SceneNode } from '../types'

/** The layers in these subtrees, the roots included, that a binding change can reach. */
export function subtreeNodes(graph: SceneGraph, roots: Iterable<string>): SceneNode[] {
  const nodes: SceneNode[] = []
  const pending = [...roots]
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    const node = graph.getNode(id)
    if (!node) continue
    nodes.push(node)
    pending.push(...node.childIds)
  }
  return nodes
}
