import { isEqual, isPlainObject, omit, sortBy } from 'es-toolkit'

import type {
  SceneGraph,
  Variable,
  VariableCollection,
  VariableLiteral,
  VariableModeMap,
  VariableType,
  VariableValue
} from '@open-pencil/scene-graph'
import { tryParseColor } from '@open-pencil/scene-graph/color'
import { getNodeVariableModeId, resolveVariableInModes } from '@open-pencil/scene-graph/variables'

import { isTreeNode, type TreeNode } from '../tree'
import {
  isMode,
  isVariable,
  type CollectionDefinition,
  type DesignVariable,
  type VariableInput
} from './index'

/**
 * Every collection a value declares, through the variables and modes in it and their aliases;
 * a collection comes after the ones it aliases, as it would be written.
 */
function collectDefinitions(
  value: unknown,
  found: Map<string, CollectionDefinition>,
  visiting = new Set<CollectionDefinition>()
): void {
  const definition = isVariable(value) || isMode(value) ? value.collection : undefined
  if (definition && typeof definition !== 'string') {
    const known = found.get(definition.name)
    if (known === definition || visiting.has(definition)) return
    if (known && !isEqual(known, definition))
      throw new Error(`Collection ${definition.name} is defined twice with different variables`)
    visiting.add(definition)
    for (const mode of definition.modes) collectDefinitions(mode.values, found, visiting)
    found.set(definition.name, definition)
    return
  }
  if (isTreeNode(value)) {
    collectDefinitions(value.props, found, visiting)
    for (const child of value.children) collectDefinitions(child, found, visiting)
  } else if (Array.isArray(value)) {
    for (const item of value) collectDefinitions(item, found, visiting)
  } else if (isPlainObject(value)) {
    for (const item of Object.values(value)) collectDefinitions(item, found, visiting)
  }
}

/** The one collection with this name; a name several collections share is an error. */
export function collectionNamed(graph: SceneGraph, name: string): VariableCollection | undefined {
  const matches = [...graph.variableCollections.values()].filter((item) => item.name === name)
  if (matches.length > 1)
    throw new Error(`More than one variable collection is named ${name}; rename one to use it`)
  return matches[0]
}

function variableNamed(
  graph: SceneGraph,
  collection: VariableCollection,
  name: string
): Variable | undefined {
  for (const id of collection.variableIds) {
    const variable = graph.variables.get(id)
    if (variable?.name === name) return variable
  }
  return undefined
}

/** Steps that put back what applying definitions changed, run last to first. */
type Undo = Array<() => void>

/** A new collection for the definition, its first mode named as the definition's. */
function createCollection(
  graph: SceneGraph,
  definition: CollectionDefinition,
  undo: Undo
): VariableCollection {
  const collection = graph.createCollection(definition.name)
  graph.renameMode(collection.id, collection.defaultModeId, definition.modes[0].name)
  // Undone after its variables, so one added since keeps it.
  undo.push(() => {
    if (collection.variableIds.length === 0) graph.removeCollection(collection.id)
  })
  return collection
}

/** The collection, with its modes in place, by the definition's names. */
function ensureCollection(
  graph: SceneGraph,
  definition: CollectionDefinition,
  undo: Undo
): VariableCollection {
  const collection =
    collectionNamed(graph, definition.name) ?? createCollection(graph, definition, undo)
  const { id } = collection
  for (const mode of definition.modes) {
    if (collection.modes.some((existing) => existing.name === mode.name)) continue
    const modeId = graph.createMode(id, mode.name)
    if (!modeId) continue
    // A mode chosen since is kept.
    undo.push(() => {
      if (graph.activeMode.get(id) !== modeId) graph.removeMode(id, modeId)
    })
  }
  const first = collection.modes.find((mode) => mode.name === definition.modes[0].name)
  if (first && collection.defaultModeId !== first.modeId) {
    const previous = collection.defaultModeId
    const order = collection.modes.map((mode) => mode.modeId)
    const chosen = first.modeId
    graph.setDefaultMode(id, chosen)
    // A default chosen since is kept; modes added since stay after the ones it knew.
    undo.push(() => {
      if (collection.defaultModeId !== chosen) return
      collection.defaultModeId = previous
      collection.modes = sortBy(collection.modes, [
        (mode) => (order.includes(mode.modeId) ? order.indexOf(mode.modeId) : order.length)
      ])
    })
  }
  return collection
}

function literalType(value: Exclude<VariableInput, DesignVariable>): VariableType {
  if (typeof value === 'number') return 'FLOAT'
  if (typeof value === 'boolean') return 'BOOLEAN'
  return 'COLOR'
}

/** The type a defined variable holds: its first value's, or for an alias, its target's. */
function definedType(
  graph: SceneGraph,
  definition: CollectionDefinition,
  name: string,
  visiting = new Set<string>()
): VariableType {
  const key = `${definition.name}\u0000${name}`
  if (visiting.has(key)) throw new Error(`Variable ${name} aliases itself`)
  visiting.add(key)
  const value = definition.modes[0].values[name]
  if (!isVariable(value)) return literalType(value)
  if (typeof value.collection === 'object')
    return definedType(graph, value.collection, value.name, visiting)
  const target = graph.variables.get(requireVariableId(graph, value))
  if (!target) throw new Error(`Unknown variable: ${value.name}`)
  return target.type
}

function storedValue(
  graph: SceneGraph,
  type: VariableType,
  name: string,
  value: VariableInput
): VariableValue {
  if (isVariable(value)) return { aliasId: requireVariableId(graph, value) }
  if (literalType(value) !== type)
    throw new Error(`Variable ${name} mixes ${type} with ${literalType(value)} values`)
  if (typeof value !== 'string') return value
  const color = tryParseColor(value)
  if (!color) throw new Error(`Variable ${name} has "${value}", which is not a color`)
  return color
}

/**
 * Create or update the collections a tree defines, by name: their modes, their variables, and
 * each variable's value in each mode, a mode's missing values taken from the first mode. Returns
 * what puts back only those changes, so edits made since are kept; a failure puts them back
 * itself.
 */
export function applyVariableDefinitions(graph: SceneGraph, tree: TreeNode): () => void {
  const undo: Undo = []
  const revert = () => {
    for (const step of undo.toReversed()) step()
  }
  try {
    applyDefinitions(graph, tree, undo)
  } catch (error) {
    revert()
    throw error
  }
  return revert
}

function applyDefinitions(graph: SceneGraph, tree: TreeNode, undo: Undo): void {
  const found = new Map<string, CollectionDefinition>()
  collectDefinitions(tree, found)
  const definitions = [...found.values()]
  const collections = definitions.map((definition) => ensureCollection(graph, definition, undo))

  const variables = definitions.map((definition, index) => {
    const collection = collections[index]
    return Object.keys(definition.modes[0].values).map((name) => {
      const type = definedType(graph, definition, name)
      const existing = variableNamed(graph, collection, name)
      if (existing && existing.type !== type)
        throw new Error(`Variable ${name} in ${definition.name} is ${existing.type}, not ${type}`)
      if (existing) return existing
      const created = graph.createVariable(name, type, collection.id)
      undo.push(() => graph.removeVariable(created.id))
      return created
    })
  })

  definitions.forEach((definition, index) => {
    const collection = collections[index]
    const [first] = definition.modes
    for (const variable of variables[index]) {
      for (const mode of definition.modes) {
        const modeId = collection.modes.find((existing) => existing.name === mode.name)?.modeId
        if (!modeId) continue
        const value = mode.values[variable.name] ?? first.values[variable.name]
        const stored = storedValue(graph, variable.type, variable.name, value)
        const previous = Object.hasOwn(variable.valuesByMode, modeId)
          ? variable.valuesByMode[modeId]
          : undefined
        undo.push(() => {
          // A value written since is kept.
          if (variable.valuesByMode[modeId] !== stored) return
          if (previous === undefined) variable.valuesByMode = omit(variable.valuesByMode, [modeId])
          else variable.valuesByMode[modeId] = previous
        })
        variable.valuesByMode[modeId] = stored
      }
    }
  })
}

/** The ID of the variable a handle refers to: by collection and name, or by ID or name. */
export function resolveVariableId(graph: SceneGraph, variable: DesignVariable): string | undefined {
  if (variable.collection) {
    const name =
      typeof variable.collection === 'string' ? variable.collection : variable.collection.name
    const collection = collectionNamed(graph, name)
    return collection && variableNamed(graph, collection, variable.name)?.id
  }
  if (graph.variables.has(variable.name)) return variable.name
  const matches = [...graph.variables.values()].filter((item) => item.name === variable.name)
  if (matches.length > 1) {
    const [first] = matches
    const collection = graph.variableCollections.get(first.collectionId)?.name ?? ''
    throw new Error(
      `Variable name ${variable.name} is in more than one collection; name one, as in designVar('${collection}', '${variable.name}')`
    )
  }
  return matches[0]?.id
}

export function requireVariableId(graph: SceneGraph, variable: DesignVariable): string {
  const id = resolveVariableId(graph, variable)
  if (id) return id
  const collection =
    typeof variable.collection === 'object' ? variable.collection.name : variable.collection
  throw new Error(
    collection
      ? `Unknown variable ${variable.name} in ${collection}`
      : `Unknown variable: ${variable.name}`
  )
}

/** The collection and mode IDs a layer's `mode` prop pins, by their names. */
export function variableModes(graph: SceneGraph, value: unknown): VariableModeMap | undefined {
  if (value === undefined) return undefined
  const modes: unknown[] = Array.isArray(value) ? value : [value]
  const result: VariableModeMap = {}
  for (const mode of modes) {
    if (!isMode(mode)) throw new Error('mode takes defineMode() or designMode() modes')
    const name = typeof mode.collection === 'string' ? mode.collection : mode.collection.name
    const collection =
      (typeof mode.collection === 'string' && graph.variableCollections.get(name)) ||
      collectionNamed(graph, name)
    if (!collection)
      throw new Error(
        `Unknown variable collection: ${name}. A defineVars() collection is added once a layer binds one of its variables`
      )
    const modeId = collection.modes.find((item) => item.name === mode.name)?.modeId
    if (!modeId) throw new Error(`Collection ${name} has no mode named ${mode.name}`)
    result[collection.id] = modeId
  }
  return result
}

/**
 * A variable's value for a layer created under `parentId`, in the modes the layer pins or else
 * the ones it inherits.
 */
export function resolveForLayer(
  graph: SceneGraph,
  variableId: string,
  parentId: string,
  modes: VariableModeMap | undefined
): VariableLiteral | undefined {
  try {
    return resolveVariableInModes(
      graph,
      variableId,
      (collectionId) =>
        modes?.[collectionId] ?? getNodeVariableModeId(graph, parentId, collectionId)
    )
  } catch {
    return undefined
  }
}

/** Where a layer is created, and the modes it pins, which give a variable its value there. */
export interface LayerContext {
  parentId: string
  modes: VariableModeMap | undefined
}

/** Bind the variable in `target[key]`, if it holds one, and put its value for the layer there. */
export function bindVariableProp(
  graph: SceneGraph,
  target: Record<string, unknown>,
  bindings: Record<string, string>,
  key: string,
  field: string,
  layer: LayerContext
): void {
  const value = target[key]
  if (!isVariable(value)) return
  const variableId = requireVariableId(graph, value)
  bindings[field] = variableId
  const resolved = resolveForLayer(graph, variableId, layer.parentId, layer.modes)
  if (resolved === undefined) throw new Error(`Cannot resolve variable ${value.name} for ${key}`)
  target[key] = resolved
}
