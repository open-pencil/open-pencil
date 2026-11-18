import { groupBy } from 'es-toolkit'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { variablesMessages } from '#vue/i18n/messages'

/** Display names by collection id, numbered where names repeat, as a file keeps no library names. */
export function collectionLabels(graph: SceneGraph): Map<string, string> {
  const collections = [...graph.variableCollections.values()]
  const byName = groupBy(collections, (collection) => collection.name)
  const messages = variablesMessages.get()
  return new Map(
    collections.map((collection) => {
      const namesakes = byName[collection.name] ?? []
      const label =
        namesakes.length > 1
          ? messages.numberedCollection({
              name: collection.name,
              number: String(namesakes.indexOf(collection) + 1)
            })
          : collection.name
      return [collection.id, label]
    })
  )
}
