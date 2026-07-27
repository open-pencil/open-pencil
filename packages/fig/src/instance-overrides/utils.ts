import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export function overrideCandidates(
  graph: SceneGraph,
  activeNodeIds?: Set<string>
): Iterable<SceneNode> {
  return activeNodeIds
    ? [...activeNodeIds]
        .map((id) => graph.getNode(id))
        .filter((node): node is SceneNode => node !== undefined)
    : graph.getAllNodes()
}
