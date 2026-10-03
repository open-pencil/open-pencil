import {
  sceneNodeToKiwi as sceneNodeToKiwiWithRuntime,
  type KiwiNodeChange,
  type SceneNodeToKiwiOptions
} from '@open-pencil/fig/node-change'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
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
  options: SceneNodeToKiwiOptions = {}
): KiwiNodeChange[] {
  return sceneNodeToKiwiWithRuntime(node, parentGuid, childIndex, localIdCounter, graph, blobs, {
    ...options,
    runtime: options.runtime ?? coreFigExportRuntime
  })
}
