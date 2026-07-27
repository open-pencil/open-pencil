import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export function* overrideCandidates(
  graph: SceneGraph,
  activeNodeIds?: Set<string>
): Iterable<SceneNode> {
  if (!activeNodeIds) {
    yield* graph.getAllNodes()
    return
  }
  for (const id of activeNodeIds) {
    const node = graph.getNode(id)
    if (node) yield node
  }
}
