import { uniq } from 'es-toolkit'

import type { SceneGraph } from '../graph'
import type { Variable, VariableCollection, VariableValue } from '../types'
import { mapVariableValueReferences } from '../variables/value'
import { requireTransferReference as mapped } from './references'

export interface VariableTransferReferences {
  variables: ReadonlyMap<string, string>
  collections: ReadonlyMap<string, string>
  modes: ReadonlyMap<string, string>
}

function assertUniqueMappings(ids: ReadonlyMap<string, string>, kind: string): void {
  if (new Set(ids.values()).size !== ids.size)
    throw new Error(`Colliding ${kind} transfer mappings`)
}

function assertResourceOwnership(
  variables: readonly Variable[],
  collections: readonly VariableCollection[]
): void {
  const sets = new Map(collections.map((collection) => [collection.id, collection]))
  const tokens = new Map(variables.map((variable) => [variable.id, variable]))
  if (sets.size !== collections.length || tokens.size !== variables.length)
    throw new Error('Duplicate source variable resource')
  for (const collection of collections) {
    const modes = new Set(collection.modes.map((mode) => mode.modeId))
    if (!modes.has(collection.defaultModeId) || modes.size !== collection.modes.length)
      throw new Error(`Invalid modes for collection ${collection.id}`)
    for (const id of collection.variableIds) {
      if (tokens.get(id)?.collectionId !== collection.id)
        throw new Error(`Invalid variable membership ${id} in ${collection.id}`)
    }
  }
  for (const variable of variables) {
    const collection = sets.get(variable.collectionId)
    if (!collection?.variableIds.includes(variable.id))
      throw new Error(`Missing collection membership for ${variable.id}`)
    const modes = new Set(collection.modes.map((mode) => mode.modeId))
    for (const mode of Object.keys(variable.valuesByMode)) {
      if (!modes.has(mode)) throw new Error(`Unknown mode ${mode} for ${variable.id}`)
    }
  }
}

/** Prepare isolated resource copies; never mutate the source or destination graph. */
export function prepareVariableTransfer(
  variables: readonly Variable[],
  collections: readonly VariableCollection[],
  references: VariableTransferReferences
): { variables: Variable[]; collections: VariableCollection[] } {
  assertResourceOwnership(variables, collections)
  assertUniqueMappings(references.variables, 'variable')
  assertUniqueMappings(references.collections, 'collection')
  assertUniqueMappings(references.modes, 'mode')
  const value = (input: VariableValue): VariableValue =>
    mapVariableValueReferences(
      input,
      (id) => mapped(references.variables, id, 'variable alias'),
      (id) => references.modes.get(id) ?? id
    )
  return {
    collections: collections.map((collection) => ({
      ...structuredClone(collection),
      id: mapped(references.collections, collection.id, 'collection'),
      defaultModeId: mapped(references.modes, collection.defaultModeId, 'mode'),
      modes: collection.modes.map((mode) => ({
        ...mode,
        modeId: mapped(references.modes, mode.modeId, 'mode')
      })),
      variableIds: collection.variableIds.map((id) => mapped(references.variables, id, 'variable'))
    })),
    variables: variables.map((variable) => ({
      ...structuredClone(variable),
      id: mapped(references.variables, variable.id, 'variable'),
      collectionId: mapped(references.collections, variable.collectionId, 'collection'),
      valuesByMode: Object.fromEntries(
        Object.entries(variable.valuesByMode).map(([mode, input]) => [
          mapped(references.modes, mode, 'mode'),
          value(input)
        ])
      )
    }))
  }
}

/**
 * Copies the variables `ids` and the collections `collectionIds` into `target`, IDs kept. Each
 * collection comes from the first of its `sources` that has it, and its variables with it; a
 * variable it lacks there comes from the next. A collection keeps only the variables copied.
 */
export function copyVariableTables(
  target: SceneGraph,
  ids: ReadonlySet<string>,
  collectionIds: Iterable<string>,
  sources: (collectionId: string) => readonly SceneGraph[]
): void {
  for (const collectionId of collectionIds) {
    const graphs = sources(collectionId)
    const first = <T>(read: (graph: SceneGraph) => T | undefined): T | undefined =>
      graphs.map(read).find((found) => found !== undefined)
    const collection = first((graph) => graph.variableCollections.get(collectionId))
    if (!collection) continue
    const members = uniq(
      graphs.flatMap((graph) => graph.variableCollections.get(collectionId)?.variableIds ?? [])
    ).filter((id) => ids.has(id))
    target.variableCollections.set(collectionId, {
      ...structuredClone(collection),
      variableIds: members
    })
    for (const id of members) {
      const variable = first((graph) => graph.variables.get(id))
      if (variable) target.variables.set(id, structuredClone(variable))
    }
  }
}
