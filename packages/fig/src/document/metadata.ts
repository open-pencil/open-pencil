import * as v from 'valibot'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { ENABLED_LIBRARIES_PLUGIN_KEY, getOpenPencilPluginValue } from '../node-change/plugin-data'

const EnabledLibrariesJSON = v.pipe(v.string(), v.parseJson(), v.array(v.unknown()))

/** One enabled-library entry; invalid entries are skipped individually. */
const EnabledLibraryEntry = v.object({
  libraryId: v.string(),
  revisionId: v.string(),
  enabled: v.optional(v.unknown())
})

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
  const bindings = v.safeParse(
    EnabledLibrariesJSON,
    getOpenPencilPluginValue(document, ENABLED_LIBRARIES_PLUGIN_KEY)
  )
  if (!bindings.success) return
  for (const candidate of bindings.output) {
    const entry = v.safeParse(EnabledLibraryEntry, candidate)
    if (!entry.success) continue
    const { libraryId, revisionId, enabled } = entry.output
    graph.enabledLibraries.set(libraryId, { libraryId, revisionId, enabled: enabled === true })
  }
}
