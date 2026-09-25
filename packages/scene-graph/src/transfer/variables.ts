import type { Variable, VariableCollection, VariableValue } from '../types'
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
  const value = (input: VariableValue): VariableValue => {
    if (typeof input === 'object' && 'aliasId' in input) {
      return { aliasId: mapped(references.variables, input.aliasId, 'variable alias') }
    }
    return structuredClone(input)
  }
  return {
    collections: collections.map((collection) => ({
      ...collection,
      id: mapped(references.collections, collection.id, 'collection'),
      defaultModeId: mapped(references.modes, collection.defaultModeId, 'mode'),
      modes: collection.modes.map((mode) => ({
        ...mode,
        modeId: mapped(references.modes, mode.modeId, 'mode')
      })),
      variableIds: collection.variableIds.map((id) => mapped(references.variables, id, 'variable'))
    })),
    variables: variables.map((variable) => ({
      ...variable,
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
