import type { SceneGraph, SceneNode, Variable, VariableCollection } from '@open-pencil/scene-graph'

export interface ClipboardVariables {
  activeModes: Array<[string, string]>
  variables: Variable[]
  collections: VariableCollection[]
}

export function captureClipboardVariables(
  graph: SceneGraph,
  nodes: SceneNode[]
): ClipboardVariables {
  const variables = new Map<string, Variable>()
  const collections = new Map<string, VariableCollection>()
  function visit(id: string) {
    if (variables.has(id)) return
    const variable = graph.variables.get(id)
    if (!variable) return
    variables.set(id, structuredClone(variable))
    const collection = graph.variableCollections.get(variable.collectionId)
    if (collection) collections.set(collection.id, structuredClone(collection))
    for (const value of Object.values(variable.valuesByMode)) {
      if (typeof value === 'object' && 'aliasId' in value) visit(value.aliasId)
    }
  }
  for (const node of nodes) for (const id of Object.values(node.boundVariables)) visit(id)
  const activeModes: Array<[string, string]> = []
  for (const collectionId of collections.keys()) {
    const modeId = graph.activeMode.get(collectionId)
    if (modeId) activeModes.push([collectionId, modeId])
  }
  return { activeModes, variables: [...variables.values()], collections: [...collections.values()] }
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
        typeof value === 'object' && 'aliasId' in value
          ? { aliasId: variableIds.get(value.aliasId) ?? value.aliasId }
          : structuredClone(value)
      ])
    )
  }))
  function apply() {
    for (const collection of collections) graph.addCollection(structuredClone(collection))
    for (const variable of variables) graph.addVariable(structuredClone(variable))
    for (const [collectionId, modeId] of dependencies.activeModes) {
      const nextCollectionId = collectionIds.get(collectionId)
      const nextModeId = modeIds.get(modeId)
      if (nextCollectionId && nextModeId) graph.activeMode.set(nextCollectionId, nextModeId)
    }
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
  node.boundVariables = Object.fromEntries(
    Object.entries(node.boundVariables).map(([field, id]) => [field, variables.get(id) ?? id])
  )
  node.variableModes = Object.fromEntries(
    Object.entries(node.variableModes).map(([id, mode]) => [
      collections.get(id) ?? id,
      modeIds.get(mode) ?? mode
    ])
  )
  for (const key of [
    'fillStyleId',
    'strokeStyleId',
    'textStyleId',
    'effectStyleId',
    'gridStyleId'
  ] as const) {
    const id = node[key]
    if (id && styleIds.has(id)) node[key] = styleIds.get(id) ?? id
  }
}
