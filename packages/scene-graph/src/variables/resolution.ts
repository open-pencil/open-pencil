import type { SceneGraph } from '../graph'
import type { Color } from '../primitives'
import type { Variable, VariableLiteral, VariableValue } from '../types'
import { MAX_FORMULA_DEPTH, VariableFormulaError } from './formula/tree'
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
    visited
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

const RESULT_TYPES = { FLOAT: 'number', BOOLEAN: 'boolean', STRING: 'string', COLOR: 'object' }

/**
 * Resolve a draft or saved definition with identical mode, dependency and error semantics. A
 * memo shares values between lookups in one mode context; without one, nothing is cached.
 */
export function resolveVariableInModes(
  graph: SceneGraph,
  variableId: string,
  modeFor: (collectionId: string) => string,
  visiting = new Set<string>(),
  memo?: Map<string, VariableLiteral>,
  overrides?: ReadonlyMap<string, VariableValue>
): VariableLiteral {
  const cached = memo?.get(variableId)
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
  return evaluateDefinition(graph, variable, value, modeFor, visiting, memo, overrides)
}

/** Resolve one variable's definition in its mode context, its dependencies in theirs. */
function evaluateDefinition(
  graph: SceneGraph,
  variable: Variable,
  value: VariableValue,
  modeFor: (collectionId: string) => string,
  visiting: Set<string>,
  memo?: Map<string, VariableLiteral>,
  overrides?: ReadonlyMap<string, VariableValue>
): VariableLiteral {
  const variableId = variable.id
  visiting.add(variableId)
  try {
    const result = resolveVariableValue(value, (id) =>
      resolveVariableInModes(graph, id, modeFor, visiting, memo, overrides)
    )
    if (result === undefined || typeof result !== RESULT_TYPES[variable.type])
      throw new VariableResolutionError('type', variableId, `Wrong result type: ${variable.name}`)
    if (typeof result === 'number' && !Number.isFinite(result))
      throw new VariableResolutionError(
        'non-finite',
        variableId,
        `Non-finite value: ${variable.name}`
      )
    // Failures can depend on the current path's depth. Only completed values are reusable.
    memo?.set(variableId, result)
    return result
  } finally {
    visiting.delete(variableId)
  }
}

/**
 * What the canvas draws for a variable, or nothing when it cannot be resolved. Literals and alias
 * chains, which most bindings are, resolve in a loop; an expression on the way takes the full
 * resolver, whose diagnostics the canvas does not need.
 */
function resolveInModes(
  graph: SceneGraph,
  variableId: string,
  modeFor: (collectionId: string) => string,
  visiting?: Set<string>,
  memo?: Map<string, VariableLiteral>
): VariableLiteral | undefined {
  const cached = memo?.get(variableId)
  if (cached !== undefined) return cached
  const initial = graph.variables.get(variableId)
  if (!initial) return undefined
  let id = variableId
  for (let depth = visiting?.size ?? 0; depth < MAX_FORMULA_DEPTH; depth++) {
    const variable = id === variableId ? initial : graph.variables.get(id)
    if (!variable || visiting?.has(id)) return undefined
    const value = variableValueInMode(graph, variable, modeFor(variable.collectionId))
    if (typeof value === 'object' && 'aliasId' in value) {
      id = value.aliasId
      continue
    }
    const result =
      typeof value === 'object' && 'expression' in value
        ? resolveExpression(graph, variable, value, modeFor, visiting, memo)
        : value
    return drawable(result, initial.type)
  }
  return undefined
}

/** A formula shares its dependencies' values for the length of one resolution. */
function resolveExpression(
  graph: SceneGraph,
  variable: Variable,
  value: VariableValue,
  modeFor: (collectionId: string) => string,
  visiting?: Set<string>,
  memo?: Map<string, VariableLiteral>
): VariableLiteral | undefined {
  try {
    return evaluateDefinition(
      graph,
      variable,
      value,
      modeFor,
      visiting ?? new Set(),
      memo ?? new Map()
    )
  } catch {
    return undefined
  }
}

/** A resolved value the canvas can draw for a variable of this type, or nothing. */
function drawable(value: VariableValue | undefined, type: Variable['type']) {
  if (value === undefined || typeof value !== RESULT_TYPES[type]) return undefined
  if (typeof value === 'object' && !('r' in value)) return undefined
  return typeof value === 'number' && !Number.isFinite(value) ? undefined : value
}

/** Shared mode fallback for canvas resolution and formula draft validation. */
export function variableValueInMode(
  graph: SceneGraph,
  variable: Variable,
  modeId: string
): VariableValue | undefined {
  const values = variable.valuesByMode
  if (Object.hasOwn(values, modeId)) return values[modeId]
  const defaultMode = graph.variableCollections.get(variable.collectionId)?.defaultModeId ?? ''
  if (Object.hasOwn(values, defaultMode)) return values[defaultMode]
  return Object.values(values).at(0)
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
      undefined,
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
  return resolveInModes(graph, variableId, (collectionId) =>
    getNodeVariableModeId(graph, nodeId, collectionId, fallback)
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
