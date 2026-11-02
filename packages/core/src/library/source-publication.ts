import type { SceneGraph, SourceLibraryPublication } from '@lawha/scene-graph'
import {
  LAWHA_PLUGIN_DATA,
  readPluginData,
  withPluginData
} from '@lawha/scene-graph/plugin-data'

export function readSourceLibraryPublication(graph: SceneGraph): SourceLibraryPublication | null {
  const root = graph.getNode(graph.rootId)
  return readPluginData(root?.pluginData, LAWHA_PLUGIN_DATA.sourceLibraryPublication) ?? null
}

export function writeSourceLibraryPublication(
  graph: SceneGraph,
  publication: SourceLibraryPublication
): void {
  const root = graph.getNode(graph.rootId)
  if (!root) return
  graph.updateNode(root.id, {
    pluginData: withPluginData(
      root.pluginData,
      LAWHA_PLUGIN_DATA.sourceLibraryPublication,
      publication
    )
  })
}
