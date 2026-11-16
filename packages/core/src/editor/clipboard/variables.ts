import type { SceneGraph, SceneNode, Variable, VariableCollection } from '@open-pencil/scene-graph'
import { remapInstanceOverrideState } from '@open-pencil/scene-graph/instances/overrides'
import {
  remappedResourceReferences,
  type LayerDependencies
} from '@open-pencil/scene-graph/transfer'
import { mapVariableValueReferences } from '@open-pencil/scene-graph/variables'

export interface ClipboardVariables {
  variables: Variable[]
  collections: VariableCollection[]
}

/** The variables and collections a copy depends on. */
export function captureClipboardVariables(
  graph: SceneGraph,
  dependencies: LayerDependencies
): ClipboardVariables {
  const variables = [...dependencies.variables].flatMap((id) => {
    const variable = graph.variables.get(id)
    return variable ? [structuredClone(variable)] : []
  })
  const collections = [...dependencies.collections].flatMap((id) => {
    const collection = graph.variableCollections.get(id)
    return collection ? [structuredClone(collection)] : []
  })
  return { variables, collections }
}

export function importClipboardVariables(graph: SceneGraph, dependencies: ClipboardVariables) {
  const variableIds = new Map(
    dependencies.variables.map((variable) => [variable.id, crypto.randomUUID()])
  )
  const collectionIds = new Map(
    dependencies.collections.map((collection) => [collection.id, crypto.randomUUID()])
  )
  const modeIds = new Map(
    dependencies.collections.flatMap((collection) =>
      collection.modes.map((mode) => [mode.modeId, crypto.randomUUID()] as const)
    )
  )
  const collections = dependencies.collections.map((collection) => ({
    ...structuredClone(collection),
    id: collectionIds.get(collection.id) ?? collection.id,
    modes: collection.modes.map((mode) => ({
      ...mode,
      modeId: modeIds.get(mode.modeId) ?? mode.modeId
    })),
    defaultModeId: modeIds.get(collection.defaultModeId) ?? collection.defaultModeId,
    variableIds: collection.variableIds.flatMap((id) => {
      const mapped = variableIds.get(id)
      return mapped ? [mapped] : []
    })
  }))
  const variables = dependencies.variables.map((variable) => ({
    ...structuredClone(variable),
    id: variableIds.get(variable.id) ?? variable.id,
    collectionId: collectionIds.get(variable.collectionId) ?? variable.collectionId,
    valuesByMode: Object.fromEntries(
      Object.entries(variable.valuesByMode).map(([mode, value]) => [
        modeIds.get(mode) ?? mode,
        mapVariableValueReferences(
          value,
          (id) => variableIds.get(id) ?? id,
          (id) => modeIds.get(id) ?? id
        )
      ])
    )
  }))
  function apply() {
    for (const collection of collections) graph.addCollection(structuredClone(collection))
    for (const variable of variables) graph.addVariable(structuredClone(variable))
  }
  function revert() {
    for (const collection of collections) graph.removeCollection(collection.id)
  }
  return { variableIds, collectionIds, modeIds, apply, revert }
}

/** Remap only declared references; never rewrite arbitrary node strings. */
export function remapClipboardVariableBindings(
  node: SceneNode,
  variables: ReadonlyMap<string, string>,
  collections: ReadonlyMap<string, string>,
  modeIds: ReadonlyMap<string, string> = new Map(),
  styleIds: ReadonlyMap<string, string> = new Map()
): void {
  const variable = (id: string) => variables.get(id) ?? id
  const collection = (id: string) => collections.get(id) ?? id
  Object.assign(
    node,
    remappedResourceReferences(node, {
      variable,
      collection,
      mode: (id) => modeIds.get(id) ?? id,
      style: (id) => styleIds.get(id) ?? id
    })
  )
  node.instanceOverrides = remapInstanceOverrideState(node.instanceOverrides, {
    node: (id) => id,
    variable,
    collection
  })
}
