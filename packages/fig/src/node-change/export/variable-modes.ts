import type { SceneNode } from '@open-pencil/scene-graph'
import type { GUID } from '@open-pencil/scene-graph/primitives'

import { parseGuidOrNull, type KiwiNodeChange } from './context'

/** The explicit variable modes of a layer, as Kiwi's `variableModeBySetMap`. */
export function serializeVariableModes(
  node: Pick<SceneNode, 'variableModes'>,
  variableIdToGuid?: Map<string, GUID>,
  modeIdToGuid?: Map<string, GUID>
): NonNullable<KiwiNodeChange['variableModeBySetMap']> | undefined {
  const entries = Object.entries(node.variableModes).flatMap(([collectionId, modeId]) => {
    const collectionGuid = variableIdToGuid?.get(collectionId) ?? parseGuidOrNull(collectionId)
    const modeGuid = modeIdToGuid?.get(modeId) ?? parseGuidOrNull(modeId)
    if (!collectionGuid || !modeGuid) return []
    return [{ variableSetID: { guid: collectionGuid }, variableModeID: modeGuid }]
  })
  return entries.length > 0 ? { entries } : undefined
}
