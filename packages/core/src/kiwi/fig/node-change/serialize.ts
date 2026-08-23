import {
  sceneNodeToKiwi as sceneNodeToKiwiWithRuntime,
  type KiwiNodeChange
} from '@open-pencil/fig/node-change'
import type { ComponentPropertyDefinition, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { GUID } from '@open-pencil/scene-graph/primitives'

import { getGlyphOutlineMetricsSync } from '#core/text/opentype'

export {
  buildFigKiwi,
  decompressFigKiwiDataAsync,
  FIG_KIWI_DEFAULT_VERSION,
  fractionalPosition,
  makeCanvasNodeChange,
  makeDocumentNodeChange,
  mapToFigmaType,
  parseFigKiwiChunks,
  safeColor
} from '@open-pencil/fig/node-change'
export { buildFontDigestMap } from './font/digests'

const coreFigExportRuntime = {
  getGlyphOutlineMetrics: getGlyphOutlineMetricsSync
}

export function sceneNodeToKiwi(
  node: SceneNode,
  parentGuid: GUID,
  childIndex: number,
  localIdCounter: { value: number },
  graph: SceneGraph,
  blobs: Uint8Array[],
  nodeIdToGuid?: Map<string, GUID>,
  fontDigestMap?: Map<string, Uint8Array>,
  varIdToGuid?: Map<string, GUID>,
  glyphBlobMap = new Map<string, number>(),
  blobIndexByHex?: Map<string, number>,
  assignedGuidValues?: Set<string>,
  componentPropertyDefinitionsById?: ReadonlyMap<string, ComponentPropertyDefinition>,
  modeIdToGuid?: Map<string, GUID>,
  propertyIdToGuid?: Map<string, GUID>
): KiwiNodeChange[] {
  return sceneNodeToKiwiWithRuntime(
    node,
    parentGuid,
    childIndex,
    localIdCounter,
    graph,
    blobs,
    nodeIdToGuid,
    fontDigestMap,
    varIdToGuid,
    glyphBlobMap,
    blobIndexByHex,
    assignedGuidValues,
    coreFigExportRuntime,
    componentPropertyDefinitionsById,
    modeIdToGuid,
    propertyIdToGuid
  )
}
