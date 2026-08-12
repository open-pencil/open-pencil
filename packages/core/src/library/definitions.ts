import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export function findLibraryDefinition(
  graph: SceneGraph,
  libraryId: string,
  assetKey: string,
  revisionId: string
): SceneNode | undefined {
  return [...graph.getAllNodes()].find((node) => {
    const identity = node.librarySource?.identity
    return (
      identity?.libraryId === libraryId &&
      identity.assetKey === assetKey &&
      identity.revisionId === revisionId
    )
  })
}
