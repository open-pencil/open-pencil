import type { SceneGraph } from '@open-pencil/scene-graph'

/** The names of the variable modes set on a layer itself, tagged after its name as in Figma. */
export function layerModeNames(
  graph: SceneGraph,
  modeIds: readonly string[] | undefined
): string[] {
  return (modeIds ?? []).flatMap((modeId) => {
    for (const collection of graph.variableCollections.values()) {
      const mode = collection.modes.find((candidate) => candidate.modeId === modeId)
      if (mode) return [mode.name]
    }
    return []
  })
}
