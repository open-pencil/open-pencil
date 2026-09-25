import type { Variable, VariableCollection } from '../types'

export function variableIdentityReferences(
  variables: readonly Variable[],
  collections: readonly VariableCollection[]
) {
  return {
    variables: new Map(variables.map((variable) => [variable.id, variable.id])),
    collections: new Map(collections.map((collection) => [collection.id, collection.id])),
    modes: new Map(
      collections.flatMap((collection) =>
        collection.modes.map((mode) => [mode.modeId, mode.modeId] as const)
      )
    )
  }
}
