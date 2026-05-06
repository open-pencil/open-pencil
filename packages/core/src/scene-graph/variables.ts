import { BLACK } from '#core/constants'
import type { Color } from '#core/types'

import type { SceneGraph } from './index'
import type { Variable, VariableCollection, VariableType, VariableValue } from './types'

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
    for (const [field, varId] of Object.entries(node.boundVariables)) {
      if (varId === id) delete node.boundVariables[field]
    }
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

export function getActiveModeId(graph: SceneGraph, collectionId: string): string {
  const mode = graph.activeMode.get(collectionId)
  if (mode) return mode
  const collection = graph.variableCollections.get(collectionId)
  return collection?.defaultModeId ?? ''
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

export function removeMode(graph: SceneGraph, collectionId: string, modeId: string): void {
  const collection = graph.variableCollections.get(collectionId)
  if (!collection || collection.modes.length <= 1) return
  collection.modes = collection.modes.filter((m) => m.modeId !== modeId)
  if (collection.defaultModeId === modeId) {
    collection.defaultModeId = collection.modes[0].modeId
  }
  for (const varId of collection.variableIds) {
    const variable = graph.variables.get(varId)
    if (variable) delete variable.valuesByMode[modeId]
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
}

export function resolveVariable(
  graph: SceneGraph,
  variableId: string,
  modeId?: string,
  visited?: Set<string>
): VariableValue | undefined {
  if (visited?.has(variableId)) return undefined
  const variable = graph.variables.get(variableId)
  if (!variable) return undefined
  const collection = graph.variableCollections.get(variable.collectionId)
  const preferredModeId = modeId ?? getActiveModeId(graph, variable.collectionId)
  const fallbackModeId = collection?.defaultModeId
  let value = Object.hasOwn(variable.valuesByMode, preferredModeId)
    ? variable.valuesByMode[preferredModeId]
    : undefined
  if (
    value === undefined &&
    fallbackModeId &&
    Object.hasOwn(variable.valuesByMode, fallbackModeId)
  ) {
    value = variable.valuesByMode[fallbackModeId]
  }
  value ??= Object.values(variable.valuesByMode)[0]
  if (value && typeof value === 'object' && 'aliasId' in value) {
    const seen = visited ?? new Set<string>()
    seen.add(variableId)
    return resolveVariable(graph, value.aliasId, preferredModeId, seen)
  }
  return value
}

export function resolveColorVariable(graph: SceneGraph, variableId: string): Color | undefined {
  const value = resolveVariable(graph, variableId)
  if (value && typeof value === 'object' && 'r' in value) return value
  return undefined
}

export function resolveNumberVariable(graph: SceneGraph, variableId: string): number | undefined {
  const value = resolveVariable(graph, variableId)
  return typeof value === 'number' ? value : undefined
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
  if (node) node.boundVariables[field] = variableId
}

export function unbindVariable(graph: SceneGraph, nodeId: string, field: string): void {
  const node = graph.nodes.get(nodeId)
  if (node) delete node.boundVariables[field]
}
