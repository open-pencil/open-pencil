import type { SceneGraph } from '#scene-graph/graph'
import type { VariableLiteral, VariableValue } from '#scene-graph/types'

import { resolveVariableInModes } from '../resolution'
import { parseFormulaSyntax, type FormulaReference } from './parse'
import { printFormula, type PrintFormulaOptions } from './print'
import type { FormulaValueType } from './signatures'
import { isFormulaOperation, VariableFormulaError } from './tree'

export { printFormula, type PrintFormulaOptions } from './print'
export {
  formulaTokenName,
  formulaTokens,
  readFormulaToken,
  type FormulaToken,
  type FormulaTokenKind
} from './tokens'

export { evaluateVariableFormula } from './evaluate'
export { formulaValueType, inferFormulaType } from './check'
export { formulaArity, formulaSymbol, type FormulaValueType } from './signatures'
export {
  foldFormula,
  isFormulaOperation,
  isFormulaReference,
  MAX_FORMULA_DEPTH,
  VariableFormulaError,
  type FormulaFold
} from './tree'

function qualifiedName(graph: SceneGraph, id: string) {
  const variable = graph.variables.get(id)
  if (!variable) return undefined
  const collection = graph.variableCollections.get(variable.collectionId)
  return `${collection?.name ?? variable.collectionId}::${variable.name}`
}

/** Qualified names disambiguate references; the stored formula uses stable IDs. */
export function variableFormulaReference(graph: SceneGraph, id: string): string {
  const variable = graph.variables.get(id)
  if (!variable) return `{#${id}}`
  const unique = (name: string, of: (id: string) => string | undefined) =>
    [...graph.variables.keys()].filter((other) => of(other) === name).length === 1
  const plain = variable.name
  if (
    !/[{}]/.test(plain) &&
    plain.trim() === plain &&
    unique(plain, (other) => graph.variables.get(other)?.name)
  )
    return `{${plain}}`
  const qualified = qualifiedName(graph, id) ?? ''
  return /[{}]/.test(qualified) || !unique(qualified, (other) => qualifiedName(graph, other))
    ? `{#${id}}`
    : `{${qualified}}`
}

/** The formula's source text, with `{name}` for each reference, as the clipboard and scripts write it; text is quoted. */
export function formatVariableFormula(
  graph: SceneGraph,
  value: VariableValue,
  options?: PrintFormulaOptions
): string {
  const reference = (id: string) => variableFormulaReference(graph, id)
  const typed = { type: (id: string) => graph.variables.get(id)?.type, ...options }
  if (typeof value !== 'object' || !('expression' in value))
    return printFormula(value, reference, typed)
  return value.expression === 'FORMULA' ? printFormula(value.value, reference, typed) : ''
}

/**
 * Find the variable a reference names: `#id`, `Collection::name`, or a name, preferring the
 * edited variable's own collection when a name appears in several.
 */
function resolveReference(graph: SceneGraph, collectionId: string, name: string): FormulaReference {
  const candidates = [...graph.variables.values()].filter(
    (candidate) =>
      name === `#${candidate.id}` ||
      name === qualifiedName(graph, candidate.id) ||
      name === candidate.name
  )
  const local = candidates.filter((candidate) => candidate.collectionId === collectionId)
  const matches = local.length === 1 ? local : candidates
  const match = matches.at(0)
  if (!match) throw new VariableFormulaError(`No variable named ${name}`)
  if (matches.length !== 1)
    throw new VariableFormulaError(`More than one variable is named ${name}`)
  return { id: match.id, type: match.type }
}

const TYPE_NAMES: Record<FormulaValueType, string> = {
  FLOAT: 'a number',
  BOOLEAN: 'true or false',
  STRING: 'text',
  COLOR: 'a color'
}

/** Validate a draft without changing the document. Formulas operate on stored units. */
export function parseVariableFormula(
  graph: SceneGraph,
  variableId: string,
  modeId: string,
  source: string
): { value: VariableValue; resolved: VariableLiteral } {
  const variable = graph.variables.get(variableId)
  if (!variable) throw new VariableFormulaError('Select a variable')
  const collection = graph.variableCollections.get(variable.collectionId)
  if (!collection?.modes.some((mode) => mode.modeId === modeId))
    throw new VariableFormulaError('Unknown variable mode')
  const { node, type } = parseFormulaSyntax(source, (name) =>
    resolveReference(graph, variable.collectionId, name)
  )
  if (type !== variable.type)
    throw new VariableFormulaError(
      `This gives ${TYPE_NAMES[type]}, but ${variable.name} holds ${TYPE_NAMES[variable.type]}`
    )
  const value: VariableValue = isFormulaOperation(node)
    ? { expression: 'FORMULA', type: variable.type, value: node }
    : node
  const resolved = resolveVariableInModes(
    graph,
    variableId,
    (collectionId) =>
      collectionId === variable.collectionId ? modeId : graph.getActiveModeId(collectionId),
    new Set(),
    new Map(),
    new Map([[variableId, value]])
  )
  return { value, resolved }
}
