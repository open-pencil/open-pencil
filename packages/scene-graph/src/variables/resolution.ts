import type { SceneGraph } from '../index'
import type { Color } from '../primitives'
import type { Variable, VariableLiteral, VariableValue } from '../types'
import { MAX_FORMULA_DEPTH, VariableFormulaError } from './formula/evaluate'
import { resolveVariableValue } from './value'

export function getActiveModeId(graph: SceneGraph, collectionId: string): string {
  const mode = graph.activeMode.get(collectionId)
  if (mode) return mode
  const collection = graph.variableCollections.get(collectionId)
  return collection?.defaultModeId ?? ''
}

/**
 * What a node without an explicit mode falls back to: the mode the editor shows (`active`), or
 * the collection's default (`default`), which is what a saved document means to other tools.
 */
export type VariableModeFallback = 'active' | 'default'

export function getNodeVariableModeId(
  graph: SceneGraph,
  nodeId: string,
  collectionId: string,
  fallback: VariableModeFallback = 'active'
): string {
  let node = graph.nodes.get(nodeId)
  while (node) {
    const modeId = node.variableModes[collectionId]
    if (modeId) return modeId
    node = node.parentId ? graph.nodes.get(node.parentId) : undefined
  }
  if (fallback === 'default')
    return graph.variableCollections.get(collectionId)?.defaultModeId ?? ''
  return getActiveModeId(graph, collectionId)
}

export function resolveVariable(
  graph: SceneGraph,
  variableId: string,
  modeId?: string,
  visited?: Set<string>
): VariableLiteral | undefined {
  const initial = graph.variables.get(variableId)
  return resolveInModes(
    graph,
    variableId,
    (collectionId) =>
      modeId && initial?.collectionId === collectionId
        ? modeId
        : getActiveModeId(graph, collectionId),
    visited ?? new Set()
  )
}

export class VariableResolutionError extends VariableFormulaError {
  override name = 'VariableResolutionError'
  constructor(
    readonly code: 'cycle' | 'depth' | 'missing-variable' | 'missing-value' | 'type' | 'non-finite',
    readonly variableId: string,
    message: string
  ) {
    super(message)
  }
}

/** Resolve a draft or saved definition with identical mode, dependency and error semantics. */
export function resolveVariableInModes(
  graph: SceneGraph,
  variableId: string,
  modeFor: (collectionId: string) => string,
  visiting = new Set<string>(),
  memo = new Map<string, VariableLiteral>(),
  overrides?: ReadonlyMap<string, VariableValue>
): VariableLiteral {
  const cached = memo.get(variableId)
  if (cached !== undefined) return cached
  if (visiting.has(variableId))
    throw new VariableResolutionError('cycle', variableId, 'Circular variable reference')
  if (visiting.size >= MAX_FORMULA_DEPTH)
    throw new VariableResolutionError('depth', variableId, 'Too many linked variables')
  const variable = graph.variables.get(variableId)
  if (!variable)
    throw new VariableResolutionError(
      'missing-variable',
      variableId,
      `Missing variable: ${variableId}`
    )
  const value =
    overrides?.get(variableId) ??
    variableValueInMode(graph, variable, modeFor(variable.collectionId))
  if (value === undefined)
    throw new VariableResolutionError(
      'missing-value',
      variableId,
      `Missing value: ${variable.name}`
    )
  visiting.add(variableId)
  try {
    const result = resolveVariableValue(value, (id) =>
      resolveVariableInModes(graph, id, modeFor, visiting, memo, overrides)
    )
    const expected = { FLOAT: 'number', BOOLEAN: 'boolean', STRING: 'string', COLOR: 'object' }[
      variable.type
    ]
    if (result === undefined || typeof result !== expected)
      throw new VariableResolutionError('type', variableId, `Wrong result type: ${variable.name}`)
    if (typeof result === 'number' && !Number.isFinite(result))
      throw new VariableResolutionError(
        'non-finite',
        variableId,
        `Non-finite value: ${variable.name}`
      )
    // Failures can depend on the current path's depth. Only completed values are reusable.
    memo.set(variableId, result)
    return result
  } finally {
    visiting.delete(variableId)
  }
}

function resolveInModes(
  graph: SceneGraph,
  variableId: string,
  modeFor: (collectionId: string) => string,
  visiting: Set<string>,
  memo = new Map<string, VariableLiteral>()
): VariableLiteral | undefined {
  try {
    return resolveVariableInModes(graph, variableId, modeFor, visiting, memo)
  } catch {
    return undefined
  }
}

/** Shared mode fallback for canvas resolution and formula draft validation. */
export function variableValueInMode(
  graph: SceneGraph,
  variable: Variable,
  modeId: string
): VariableValue | undefined {
  const read = (id: string) =>
    Object.hasOwn(variable.valuesByMode, id) ? variable.valuesByMode[id] : undefined
  const defaultMode = graph.variableCollections.get(variable.collectionId)?.defaultModeId ?? ''
  return read(modeId) ?? read(defaultMode) ?? Object.values(variable.valuesByMode).at(0)
}

export type NodeVariableResolver = (
  nodeId: string,
  variableId: string
) => VariableLiteral | undefined

/** One read/reconcile operation only: equal mode contexts share results, edits start a new cache. */
export function createBatchVariableResolver(graph: SceneGraph): NodeVariableResolver {
  const collections = [...graph.variableCollections.keys()]
  const contexts = new Map<string, Map<string, VariableLiteral>>()
  return (nodeId, variableId) => {
    const modes = collections.map((id) => getNodeVariableModeId(graph, nodeId, id))
    const key = JSON.stringify(modes)
    let memo = contexts.get(key)
    if (!memo) {
      memo = new Map()
      contexts.set(key, memo)
    }
    return resolveInModes(
      graph,
      variableId,
      (id) => modes[collections.indexOf(id)] ?? '',
      new Set(),
      memo
    )
  }
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

export function resolveColorVariableForNode(
  graph: SceneGraph,
  nodeId: string,
  variableId: string,
  fallback: VariableModeFallback = 'active'
): Color | undefined {
  const value = resolveVariableForNode(graph, nodeId, variableId, fallback)
  if (value && typeof value === 'object' && 'r' in value) return value
  return undefined
}

export function resolveNumberVariableForNode(
  graph: SceneGraph,
  nodeId: string,
  variableId: string,
  fallback: VariableModeFallback = 'active'
): number | undefined {
  const value = resolveVariableForNode(graph, nodeId, variableId, fallback)
  return typeof value === 'number' ? value : undefined
}

/** A variable's value in the mode a node is in, aliases followed. */
export function resolveVariableForNode(
  graph: SceneGraph,
  nodeId: string,
  variableId: string,
  fallback: VariableModeFallback = 'active'
): VariableLiteral | undefined {
  return resolveInModes(
    graph,
    variableId,
    (collectionId) => getNodeVariableModeId(graph, nodeId, collectionId, fallback),
    new Set()
  )
}

export function resolveStringVariableForNode(
  graph: SceneGraph,
  nodeId: string,
  variableId: string,
  fallback: VariableModeFallback = 'active'
): string | undefined {
  const value = resolveVariableForNode(graph, nodeId, variableId, fallback)
  return typeof value === 'string' ? value : undefined
}
