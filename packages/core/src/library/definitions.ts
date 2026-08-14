import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export function findLibraryDefinition(
  graph: SceneGraph,
  libraryId: string,
  assetKey: string,
  revisionId: string
): SceneNode | undefined {
  for (const node of graph.getAllNodes()) {
    const identity = node.librarySource?.identity
    if (
      identity?.libraryId === libraryId &&
      identity.assetKey === assetKey &&
      identity.revisionId === revisionId
    ) {
      return node
    }
  }
  return undefined
}
