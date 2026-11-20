import type { SceneGraph } from '@open-pencil/scene-graph'
import {
  appliedVariableModes,
  type AppliedVariableMode,
  type NumberedCollectionFormat
} from '@open-pencil/vue/controls/variable-modes'

/** The variable modes set on a layer itself, tagged after its name as in Figma. */
export function layerAppliedModes(
  graph: SceneGraph,
  variableModes: Readonly<Record<string, string>> | undefined,
  numbered: NumberedCollectionFormat
): AppliedVariableMode[] {
  return variableModes ? appliedVariableModes(graph, variableModes, numbered) : []
}

/** Each variable collection's mode IDs, which is all a layer's mode count depends on. */
export type CollectionModeIds = ReadonlyMap<string, ReadonlySet<string>>

export function collectionModeIds(graph: SceneGraph): CollectionModeIds {
  return new Map(
    [...graph.variableCollections.values()].map((collection) => [
      collection.id,
      new Set(collection.modes.map((mode) => mode.modeId))
    ])
  )
}

/** How many modes a layer's badge lists: the length of `layerAppliedModes`, without its labels. */
export function layerAppliedModeCount(
  variableModes: Readonly<Record<string, string>> | undefined,
  modeIds: CollectionModeIds
): number {
  if (!variableModes) {
    return 0
  }
  return Object.entries(variableModes).filter(([collectionId, modeId]) =>
    modeIds.get(collectionId)?.has(modeId)
  ).length
}
