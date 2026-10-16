import type {
  VariableFormulaNode,
  VariableFormulaOperator,
  VariableLiteral
} from '@open-pencil/scene-graph'

export const MAX_FORMULA_DEPTH = 64
export const MAX_FORMULA_LENGTH = 4096

export class VariableFormulaError extends Error {
  override name = 'VariableFormulaError'
}

export function formulaArity(operator: VariableFormulaOperator): number {
  return operator === 'NOT' || operator === 'NEGATE' ? 1 : 2
}

export function formulaOperandType(operator: VariableFormulaOperator): 'FLOAT' | 'BOOLEAN' {
  return ['AND', 'OR', 'NOT', 'NOT_EQUAL'].includes(operator) ? 'BOOLEAN' : 'FLOAT'
}

function apply(operator: VariableFormulaOperator, args: Array<number | boolean>): number | boolean {
  const [a, b] = args
  if (typeof a === 'number') {
    if (operator === 'NEGATE') return -a
    if (typeof b !== 'number') throw new VariableFormulaError('Expected two numbers')
    switch (operator) {
      case 'ADDITION':
        return a + b
      case 'SUBTRACTION':
        return a - b
      case 'MULTIPLY':
        return a * b
      case 'DIVIDE':
        if (b === 0) throw new VariableFormulaError('Cannot divide by zero')
        return a / b
    }
  } else {
    switch (operator) {
      case 'AND':
        return a && b
      case 'OR':
        return a || b
      case 'NOT':
        return !a
      case 'NOT_EQUAL':
        return a !== b
    }
  }
  throw new VariableFormulaError(`Invalid operands for ${operator}`)
}

/** Both sides are evaluated before Boolean logic, so false AND invalid never hides an error. */
export function evaluateVariableFormula(
  node: VariableFormulaNode,
  resolve: (id: string) => VariableLiteral | undefined,
  depth = 0
): number | boolean {
  if (depth > MAX_FORMULA_DEPTH) throw new VariableFormulaError('Formula is too deeply nested')
  let result: VariableLiteral | undefined
  if (typeof node !== 'object') result = node
  else if ('aliasId' in node) {
    result = resolve(node.aliasId)
    if (result === undefined)
      throw new VariableFormulaError(`Cannot resolve variable ${node.aliasId}`)
  } else {
    if (node.operands.length !== formulaArity(node.operator))
      throw new VariableFormulaError(`Wrong number of operands for ${node.operator}`)
    const args = node.operands.map((operand) =>
      evaluateVariableFormula(operand, resolve, depth + 1)
    )
    const expected = formulaOperandType(node.operator) === 'FLOAT' ? 'number' : 'boolean'
    if (args.some((arg) => typeof arg !== expected))
      throw new VariableFormulaError(`${node.operator} requires ${expected} values`)
    result = apply(node.operator, args)
  }
  if (typeof result !== 'number' && typeof result !== 'boolean')
    throw new VariableFormulaError('Formulas require number or Boolean variables')
  if (typeof result === 'number' && !Number.isFinite(result))
    throw new VariableFormulaError('Formula result must be finite')
  return result
}

export function mapFormulaReferences(
  node: VariableFormulaNode,
  map: (id: string) => string,
  depth = 0
): VariableFormulaNode {
  if (depth > MAX_FORMULA_DEPTH) throw new VariableFormulaError('Formula is too deeply nested')
  if (typeof node !== 'object') return node
  if ('aliasId' in node) return { aliasId: map(node.aliasId) }
  return {
    operator: node.operator,
    operands: node.operands.map((n) => mapFormulaReferences(n, map, depth + 1))
  }
}
