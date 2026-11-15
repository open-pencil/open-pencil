import type { SceneGraph } from '../graph'
import type { VariableCollection, VariableCollectionMode } from '../types'

/** What a reference by ID or name finds: one match, none, or several that share the name. */
export type NamedLookup<T> =
  | { kind: 'found'; value: T }
  | { kind: 'missing' }
  | { kind: 'ambiguous'; matches: T[] }

function byName<T extends { name: string }>(items: Iterable<T>, name: string): NamedLookup<T> {
  const matches = [...items].filter((item) => item.name === name)
  if (matches.length === 1) return { kind: 'found', value: matches[0] }
  return matches.length === 0 ? { kind: 'missing' } : { kind: 'ambiguous', matches }
}

/** The collection with this ID or, failing that, the one with this exact name. */
export function lookupCollection(graph: SceneGraph, ref: string): NamedLookup<VariableCollection> {
  const byId = graph.variableCollections.get(ref)
  if (byId) return { kind: 'found', value: byId }
  return byName(graph.variableCollections.values(), ref)
}

/** The mode of `collection` with this ID or, failing that, the one with this exact name. */
export function lookupMode(
  collection: VariableCollection,
  ref: string
): NamedLookup<VariableCollectionMode> {
  const byId = collection.modes.find((mode) => mode.modeId === ref)
  if (byId) return { kind: 'found', value: byId }
  return byName(collection.modes, ref)
}
