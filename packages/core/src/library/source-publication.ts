import * as v from 'valibot'

import type { SceneGraph } from '@open-pencil/scene-graph'

export const SOURCE_LIBRARY_PUBLICATION_PLUGIN_KEY = 'sourceLibraryPublication'
const OPEN_PENCIL_PLUGIN_ID = 'open-pencil'

export interface SourceLibraryPublication {
  libraryId: string
  revisionId: string
  name: string
  catalogSource?: string
}

const SourceLibraryPublicationJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    libraryId: v.string(),
    revisionId: v.string(),
    name: v.string(),
    catalogSource: v.optional(v.string())
  })
) satisfies v.GenericSchema<string, SourceLibraryPublication>

export function readSourceLibraryPublication(graph: SceneGraph): SourceLibraryPublication | null {
  const root = graph.getNode(graph.rootId)
  const entry = root?.pluginData.find(
    (item) =>
      item.pluginId === OPEN_PENCIL_PLUGIN_ID && item.key === SOURCE_LIBRARY_PUBLICATION_PLUGIN_KEY
  )
  if (!entry) return null
  const parsed = v.safeParse(SourceLibraryPublicationJSON, entry.value)
  return parsed.success ? parsed.output : null
}

export function writeSourceLibraryPublication(
  graph: SceneGraph,
  publication: SourceLibraryPublication
): void {
  const root = graph.getNode(graph.rootId)
  if (!root) return
  graph.updateNode(root.id, {
    pluginData: [
      ...root.pluginData.filter(
        (entry) =>
          !(
            entry.pluginId === OPEN_PENCIL_PLUGIN_ID &&
            entry.key === SOURCE_LIBRARY_PUBLICATION_PLUGIN_KEY
          )
      ),
      {
        pluginId: OPEN_PENCIL_PLUGIN_ID,
        key: SOURCE_LIBRARY_PUBLICATION_PLUGIN_KEY,
        value: JSON.stringify(publication)
      }
    ]
  })
}
