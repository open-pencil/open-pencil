import { mergePluginData, type KiwiNodeChange } from '@lawha/fig/node-change'
import type { SceneGraph } from '@lawha/scene-graph'
import {
  isPluginDataEntry,
  LAWHA_PLUGIN_DATA,
  withoutPluginData,
  withPluginData
} from '@lawha/scene-graph/plugin-data'

const { documentId, enabledLibraries } = LAWHA_PLUGIN_DATA

/** The DOCUMENT record's plugin data: the root's own, the libraries it enables, and its id. */
export function applyDocumentPluginData(
  documentNodeChange: KiwiNodeChange,
  graph: SceneGraph
): void {
  const rootPluginData = graph.getNode(graph.rootId)?.pluginData ?? []
  const bindings = [...graph.enabledLibraries.values()]
  // With no libraries enabled, the entry the document was opened with is kept as it was.
  const opened = rootPluginData.find((entry) => isPluginDataEntry(entry, enabledLibraries))
  const withLibraries =
    bindings.length > 0
      ? withPluginData(rootPluginData, enabledLibraries, bindings)
      : [...withoutPluginData(rootPluginData, [enabledLibraries]), ...(opened ? [opened] : [])]
  documentNodeChange.pluginData = mergePluginData(
    withPluginData(withLibraries, documentId, graph.rootId)
  )
}
