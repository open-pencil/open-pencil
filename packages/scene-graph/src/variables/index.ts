import { partition } from 'es-toolkit/array'
import { omit, omitBy } from 'es-toolkit/object'

import { BLACK } from '../constants'
import type { SceneGraph } from '../graph'
import { findInstanceAncestor } from '../instances'
import { bindingOverrideField, setInstanceOverride } from '../instances/overrides'
import type {
  Variable,
  VariableCollection,
  VariableCollectionMode,
  VariableType,
  VariableValue
} from '../types'
import {
  isNumericVariableBindingField,
  variableBindingOwner,
  assignVariableBindingUnits
} from './bindings'
import {
  BOOLEAN_BINDING_FIELDS,
  paintBindingTarget,
  STRING_BINDING_FIELDS,
  TEXT_CONTENT_VARIABLE_TYPES,
  VISIBILITY_VARIABLE_TYPES
} from './fields'

export * from './resolution'

export function addVariable(graph: SceneGraph, variable: Variable): void {
  graph.variables.set(variable.id, variable)
  const collection = graph.variableCollections.get(variable.collectionId)
  if (collection && !collection.variableIds.includes(variable.id)) {
    collection.variableIds.push(variable.id)
  }
}

export function removeVariable(graph: SceneGraph, id: string): void {
  const variable = graph.variables.get(id)
  if (!variable) return
  graph.variables.delete(id)
  const collection = graph.variableCollections.get(variable.collectionId)
  if (collection) {
    collection.variableIds = collection.variableIds.filter((vid) => vid !== id)
  }
  for (const node of graph.nodes.values()) {
    const hadBinding = Object.values(node.boundVariables).includes(id)
    if (!hadBinding) continue
    graph.willChangeNode(node)
    node.boundVariables = omitBy(node.boundVariables, (varId) => varId === id) as Record<
      string,
      string
    >
    node.variableBindingScales = omitBy(
      node.variableBindingScales,
      (_, field) => !(field in node.boundVariables)
    )
    graph.emitter.emit('node:updated', node.id, {
      boundVariables: { ...node.boundVariables },
      variableBindingScales: { ...node.variableBindingScales }
    })
    markBoundVariablesOverrideOnInstance(graph, node.id)
  }
}

export function addCollection(graph: SceneGraph, collection: VariableCollection): void {
  graph.variableCollections.set(collection.id, collection)
  if (!graph.activeMode.has(collection.id)) {
    graph.activeMode.set(collection.id, collection.defaultModeId)
  }
}

function defaultVariableValue(type: VariableType, value?: VariableValue): VariableValue {
  if (value !== undefined) return value
  if (type === 'COLOR') return { ...BLACK }
  if (type === 'FLOAT') return 0
  if (type === 'BOOLEAN') return false
  return ''
}

export function createVariable(
  graph: SceneGraph,
  generateId: () => string,
  name: string,
  type: VariableType,
  collectionId: string,
  value?: VariableValue
): Variable {
  const collection = graph.variableCollections.get(collectionId)
  if (!collection) throw new Error(`Collection "${collectionId}" not found`)
  const id = generateId()
  const defaultValue = defaultVariableValue(type, value)
  const valuesByMode: Record<string, VariableValue> = {}
  for (const mode of collection.modes) {
    valuesByMode[mode.modeId] = structuredClone(defaultValue)
  }
  const variable: Variable = {
    id,
    name,
    type,
    collectionId,
    valuesByMode,
    description: '',
    hiddenFromPublishing: false
  }
  addVariable(graph, variable)
  return variable
}

export function createCollection(
  graph: SceneGraph,
  generateId: () => string,
  name: string
): VariableCollection {
  const id = generateId()
  const modeId = generateId()
  const collection: VariableCollection = {
    id,
    name,
    modes: [{ modeId, name: 'Mode 1' }],
    defaultModeId: modeId,
    variableIds: []
  }
  addCollection(graph, collection)
  return collection
}

export function removeCollection(graph: SceneGraph, id: string): void {
  const collection = graph.variableCollections.get(id)
  if (collection) {
    for (const varId of Array.from(collection.variableIds)) {
      removeVariable(graph, varId)
    }
  }
  graph.variableCollections.delete(id)
  graph.activeMode.delete(id)
}

export function setActiveMode(graph: SceneGraph, collectionId: string, modeId: string): void {
  graph.activeMode.set(collectionId, modeId)
}

export function addMode(
  graph: SceneGraph,
  collectionId: string,
  modeId: string,
  name: string,
  sourceMode?: string
): void {
  const collection = graph.variableCollections.get(collectionId)
  if (!collection) return
  collection.modes.push({ modeId, name })
  const sourceModeId = sourceMode ?? collection.defaultModeId
  for (const varId of collection.variableIds) {
    const variable = graph.variables.get(varId)
    if (!variable) continue
    variable.valuesByMode[modeId] = structuredClone(
      variable.valuesByMode[sourceModeId] ?? Object.values(variable.valuesByMode)[0]
    )
  }
}

/** Add a mode with a new ID from `generateId`; undo and redo replay it with `addMode`. */
export function createMode(
  graph: SceneGraph,
  generateId: () => string,
  collectionId: string,
  name: string,
  sourceMode?: string
): string | undefined {
  if (!graph.variableCollections.has(collectionId)) return undefined
  const modeId = generateId()
  addMode(graph, collectionId, modeId, name, sourceMode)
  return modeId
}

export function removeMode(graph: SceneGraph, collectionId: string, modeId: string): void {
  const collection = graph.variableCollections.get(collectionId)
  if (!collection || collection.modes.length <= 1) return
  collection.modes = collection.modes.filter((m) => m.modeId !== modeId)
  if (collection.defaultModeId === modeId) {
    collection.defaultModeId = collection.modes[0].modeId
  }
  for (const varId of collection.variableIds) {
    const variable = graph.variables.get(varId)
    if (variable) variable.valuesByMode = omit(variable.valuesByMode, [modeId])
  }
  if (graph.activeMode.get(collectionId) === modeId) {
    graph.activeMode.set(collectionId, collection.defaultModeId)
  }
}

export function renameMode(
  graph: SceneGraph,
  collectionId: string,
  modeId: string,
  name: string
): void {
  const collection = graph.variableCollections.get(collectionId)
  if (!collection) return
  const mode = collection.modes.find((m) => m.modeId === modeId)
  if (mode) mode.name = name
}

export function setDefaultMode(graph: SceneGraph, collectionId: string, modeId: string): void {
  const collection = graph.variableCollections.get(collectionId)
  if (!collection) return
  if (!collection.modes.some((m) => m.modeId === modeId)) return
  collection.defaultModeId = modeId
  collection.modes = modesDefaultFirst(collection)
}

/** Figma has no default-mode field: the first mode is the default. */
export function modesDefaultFirst(collection: VariableCollection): VariableCollectionMode[] {
  const [defaults, rest] = partition(collection.modes, (m) => m.modeId === collection.defaultModeId)
  return [...defaults, ...rest]
}

export function getVariablesForCollection(graph: SceneGraph, collectionId: string): Variable[] {
  const collection = graph.variableCollections.get(collectionId)
  if (!collection) return []
  return collection.variableIds
    .map((id) => graph.variables.get(id))
    .filter((v): v is Variable => v !== undefined)
}

export function getVariablesByType(graph: SceneGraph, type: VariableType): Variable[] {
  return [...graph.variables.values()].filter((v) => v.type === type)
}

export function bindVariable(
  graph: SceneGraph,
  nodeId: string,
  field: string,
  variableId: string
): void {
  const node = graph.nodes.get(nodeId)
  if (!node) return

  // Validate variable exists
  const variable = graph.variables.get(variableId)
  if (!variable) {
    throw new Error(`Variable "${variableId}" not found`)
  }

  // Color fields require COLOR variable type
  const paint = paintBindingTarget(field)
  if (paint) {
    if (variable.type !== 'COLOR') {
      throw new Error(`Cannot bind ${variable.type} variable to color field "${field}"`)
    }
    // Validate index is within current array bounds
    const currentLength = node[paint.list].length
    if (paint.index >= currentLength) {
      throw new Error(
        `Index ${paint.index} out of range for ${paint.list} (length ${currentLength})`
      )
    }
    // Auto-remove top-level dead binding (e.g. 'fills') when setting indexed binding
    if (paint.list in node.boundVariables) {
      node.boundVariables = omit(node.boundVariables, [paint.list])
    }
  }

  if (isNumericVariableBindingField(field) && variable.type !== 'FLOAT') {
    throw new Error(`Cannot bind ${variable.type} variable to scalar field "${field}"`)
  }

  const textTypes: readonly VariableType[] =
    field === 'text' ? TEXT_CONTENT_VARIABLE_TYPES : ['STRING']
  if (STRING_BINDING_FIELDS.has(field) && !textTypes.includes(variable.type)) {
    throw new Error(`Cannot bind ${variable.type} variable to string field "${field}"`)
  }

  if (
    BOOLEAN_BINDING_FIELDS.has(field) &&
    !VISIBILITY_VARIABLE_TYPES.some((type) => type === variable.type)
  ) {
    throw new Error(`Cannot bind ${variable.type} variable to boolean field "${field}"`)
  }

  const isKnownField =
    isNumericVariableBindingField(field) ||
    STRING_BINDING_FIELDS.has(field) ||
    BOOLEAN_BINDING_FIELDS.has(field) ||
    paint !== null

  if (!isKnownField) {
    throw new Error(`Unknown binding field "${field}"`)
  }

  graph.willChangeNode(node)
  node.boundVariables = { ...node.boundVariables, [field]: variableId }
  assignVariableBindingUnits(graph, node, field)
  markBoundVariablesOverrideOnInstance(graph, nodeId, field)
  graph.emitter.emit('node:updated', nodeId, {
    boundVariables: { ...node.boundVariables },
    variableBindingScales: { ...node.variableBindingScales }
  })
}

export function unbindVariable(graph: SceneGraph, nodeId: string, field: string): void {
  const node = graph.nodes.get(nodeId)
  if (!node) return
  if (!(field in node.boundVariables)) return
  graph.willChangeNode(node)
  node.boundVariables = omit(node.boundVariables, [field])
  node.variableBindingScales = omit(node.variableBindingScales, [field])
  markBoundVariablesOverrideOnInstance(graph, nodeId, field)
  graph.emitter.emit('node:updated', nodeId, {
    boundVariables: { ...node.boundVariables },
    variableBindingScales: { ...node.variableBindingScales }
  })
}

function markBoundVariablesOverrideOnInstance(
  graph: SceneGraph,
  nodeId: string,
  field?: string
): void {
  const node = graph.nodes.get(nodeId)
  if (!node) return

  const owner = variableBindingOwner(graph, node)
  if (owner.type !== 'INSTANCE') return
  const nearest = findInstanceAncestor(graph, nodeId)
  if (nearest) setInstanceOverride(nearest.instanceOverrides, nearest.id, nodeId, 'boundVariables')
  setInstanceOverride(owner.instanceOverrides, owner.id, nodeId, 'boundVariables')
  if (field)
    setInstanceOverride(
      owner.instanceOverrides,
      owner.id,
      nodeId,
      bindingOverrideField(field),
      node.boundVariables[field] ?? null
    )
}

export * from './bindings'
export * from './corners'
export * from './formula'
export * from './formula/schema'
export * from './schema'
export * from './text'
export * from './token'
export * from './value'
