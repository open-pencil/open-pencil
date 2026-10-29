import type {
  VariableAlias,
  VariableFormulaNode,
  VariableFormulaOperation,
  VariableLiteral
} from '#scene-graph/types'

export const MAX_FORMULA_DEPTH = 64
export const MAX_FORMULA_LENGTH = 4096

export class VariableFormulaError extends Error {
  override name = 'VariableFormulaError'
}

export function isFormulaOperation(node: VariableFormulaNode): node is VariableFormulaOperation {
  return typeof node === 'object' && 'operator' in node
}

export function isFormulaReference(node: VariableFormulaNode): node is VariableAlias {
  return typeof node === 'object' && 'aliasId' in node
}

/** What a fold makes of each kind of node; an operation gets its operands' results. */
export interface FormulaFold<T> {
  literal: (value: VariableLiteral) => T
  reference: (id: string) => T
  operation: (node: VariableFormulaOperation, operands: T[]) => T
}

/**
 * Walk a formula bottom-up, as evaluating, type checking, remapping and writing it to another
 * format all do. A tree deeper than `MAX_FORMULA_DEPTH` is refused rather than walked.
 */
export function foldFormula<T>(node: VariableFormulaNode, fold: FormulaFold<T>, depth = 0): T {
  if (depth > MAX_FORMULA_DEPTH) throw new VariableFormulaError('Formula is too deeply nested')
  if (isFormulaOperation(node))
    return fold.operation(
      node,
      node.operands.map((operand) => foldFormula(operand, fold, depth + 1))
    )
  return isFormulaReference(node) ? fold.reference(node.aliasId) : fold.literal(node)
}

export function mapFormulaReferences(
  node: VariableFormulaNode,
  map: (id: string) => string
): VariableFormulaNode {
  return foldFormula<VariableFormulaNode>(node, {
    literal: (value) => (typeof value === 'object' ? { ...value } : value),
    reference: (id) => ({ aliasId: map(id) }),
    operation: ({ operator }, operands) => ({ operator, operands })
  })
}
