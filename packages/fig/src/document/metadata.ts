import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { ENABLED_LIBRARIES_PLUGIN_KEY, getOpenPencilPluginValue } from '../node-change/plugin-data'

export function applyDocumentMetadata(graph: SceneGraph, document: NodeChange | undefined): void {
  const root = graph.getNode(graph.rootId)
  if (!root || !document) return
  root.source.format = 'fig'
  root.pluginData =
    document.pluginData?.map((entry) => ({
      pluginId: entry.pluginID,
      key: entry.key,
      value: entry.value
    })) ?? []
  root.source.fig.rawNodeFields.strokeJoin = document.strokeJoin
  root.source.fig.rawNodeFields.strokeWeight = document.strokeWeight
  const bindings = getOpenPencilPluginValue(document, ENABLED_LIBRARIES_PLUGIN_KEY)
  if (!bindings) return
  let parsed: unknown
  try {
    parsed = JSON.parse(bindings)
  } catch {
    return
  }
  if (!Array.isArray(parsed)) return
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    if (!('libraryId' in entry) || !('revisionId' in entry)) continue
    if (typeof entry.libraryId !== 'string' || typeof entry.revisionId !== 'string') continue
    graph.enabledLibraries.set(entry.libraryId, {
      libraryId: entry.libraryId,
      revisionId: entry.revisionId,
      enabled: 'enabled' in entry && entry.enabled === true
    })
  }
}
