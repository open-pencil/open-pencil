import type { SceneGraph } from '@open-pencil/scene-graph'

export const SOURCE_LIBRARY_PUBLICATION_PLUGIN_KEY = 'sourceLibraryPublication'
const OPEN_PENCIL_PLUGIN_ID = 'open-pencil'

export interface SourceLibraryPublication {
  libraryId: string
  revisionId: string
  name: string
  catalogSource?: string
}

function isPublication(value: unknown): value is SourceLibraryPublication {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const publication = value as Partial<SourceLibraryPublication>
  return (
    typeof publication.libraryId === 'string' &&
    typeof publication.revisionId === 'string' &&
    typeof publication.name === 'string' &&
    (publication.catalogSource === undefined || typeof publication.catalogSource === 'string')
  )
}

export function readSourceLibraryPublication(graph: SceneGraph): SourceLibraryPublication | null {
  const root = graph.getNode(graph.rootId)
  const entry = root?.pluginData.find(
    (item) =>
      item.pluginId === OPEN_PENCIL_PLUGIN_ID && item.key === SOURCE_LIBRARY_PUBLICATION_PLUGIN_KEY
  )
  if (!entry) return null
  try {
    const parsed: unknown = JSON.parse(entry.value)
    return isPublication(parsed) ? parsed : null
  } catch {
    return null
  }
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
