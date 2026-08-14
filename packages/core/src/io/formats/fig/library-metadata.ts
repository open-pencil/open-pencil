import {
  ENABLED_LIBRARIES_PLUGIN_KEY,
  mergePluginData,
  OPEN_PENCIL_PLUGIN_ID
} from '@open-pencil/fig/node-change'
import type { KiwiNodeChange } from '@open-pencil/fig/node-change'
import type { SceneGraph } from '@open-pencil/scene-graph'

export function applyEnabledLibrariesPluginData(
  documentNodeChange: KiwiNodeChange,
  graph: SceneGraph
): void {
  const rootPluginData = graph.getNode(graph.rootId)?.pluginData ?? []
  const bindings = [...graph.enabledLibraries.values()]
  const managedBinding = rootPluginData.find(
    (entry) =>
      entry.pluginId === OPEN_PENCIL_PLUGIN_ID && entry.key === ENABLED_LIBRARIES_PLUGIN_KEY
  )
  const bindingEntry =
    bindings.length > 0
      ? {
          pluginId: OPEN_PENCIL_PLUGIN_ID,
          key: ENABLED_LIBRARIES_PLUGIN_KEY,
          value: JSON.stringify(bindings)
        }
      : managedBinding
  documentNodeChange.pluginData = mergePluginData([
    ...rootPluginData.filter(
      (entry) =>
        !(entry.pluginId === OPEN_PENCIL_PLUGIN_ID && entry.key === ENABLED_LIBRARIES_PLUGIN_KEY)
    ),
    ...(bindingEntry ? [bindingEntry] : [])
  ])
}
