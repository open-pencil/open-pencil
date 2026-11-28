import { groupBy } from 'es-toolkit'

import type { SceneGraph, VariableCollection } from '@open-pencil/scene-graph'

/** Names a collection by its number among same-named ones, as `numberedCollection` does. */
export type NumberedCollectionFormat = (params: { name: string; number: string }) => string

function sameName(collections: readonly VariableCollection[]) {
  return groupBy(collections, (collection) => collection.name)
}

/**
 * Display names of the `shown` collections, all of the file's by default. Where two or more shown
 * collections share a name, each gets its number among the file's same-named collections, so a
 * collection keeps one number in every list; a file keeps no library names to tell them apart.
 */
export function collectionLabels(
  graph: SceneGraph,
  numbered: NumberedCollectionFormat,
  shown: readonly string[] = [...graph.variableCollections.keys()]
): Map<string, string> {
  const shownIds = new Set(shown)
  const collections = [...graph.variableCollections.values()]
  const listed = collections.filter((collection) => shownIds.has(collection.id))
  const inFile = sameName(collections)
  const inList = sameName(listed)
  return new Map(
    listed.map((collection) => {
      const { name } = collection
      const label =
        inList[name].length > 1
          ? numbered({ name, number: String(inFile[name].indexOf(collection) + 1) })
          : name
      return [collection.id, label]
    })
  )
}
