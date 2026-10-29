import { mergePluginData, type KiwiNodeChange } from '@open-pencil/fig/node-change'
import type { SceneGraph } from '@open-pencil/scene-graph'
import {
  isPluginDataEntry,
  OPEN_PENCIL_PLUGIN_DATA,
  withoutPluginData,
  withPluginData
} from '@open-pencil/scene-graph/plugin-data'

const { documentId, enabledLibraries } = OPEN_PENCIL_PLUGIN_DATA

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
