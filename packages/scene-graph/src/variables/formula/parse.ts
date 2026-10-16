import jsep from 'jsep'

import type { VariableFormulaNode, VariableFormulaOperator } from '@open-pencil/scene-graph'

import { MAX_FORMULA_DEPTH, MAX_FORMULA_LENGTH, VariableFormulaError } from './evaluate'

const BINARY = new Map<string, VariableFormulaOperator>([
  ['+', 'ADDITION'],
  ['-', 'SUBTRACTION'],
  ['*', 'MULTIPLY'],
  ['/', 'DIVIDE'],
  ['AND', 'AND'],
  ['OR', 'OR'],
  ['XOR', 'NOT_EQUAL']
])
const WORD_PRECEDENCE: Record<string, number> = { OR: 1, NOR: 1, XOR: 2, AND: 3, NAND: 3 }

/** Temporarily extend jsep only for this synchronous parse; calc's grammar stays unchanged. */
function parseTree(source: string): jsep.Expression {
  const saved = new Map(
    Object.keys(WORD_PRECEDENCE).map((op) => [
      op,
      Object.hasOwn(jsep.binary_ops, op) ? jsep.binary_ops[op] : undefined
    ])
  )
  try {
    for (const [op, precedence] of Object.entries(WORD_PRECEDENCE)) jsep.addBinaryOp(op, precedence)
    return jsep(source)
  } finally {
    for (const [op, precedence] of saved) {
      jsep.removeBinaryOp(op)
      if (precedence !== undefined) jsep.addBinaryOp(op, precedence)
    }
  }
}

function convert(
  node: jsep.Expression,
  references: ReadonlyMap<string, string>,
  depth = 0
): VariableFormulaNode {
  if (depth > MAX_FORMULA_DEPTH) throw new VariableFormulaError('Formula is too deeply nested')
  if (node.type === 'Literal') {
    const { value } = node as jsep.Literal
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))
      return value
  }
  if (node.type === 'Identifier') {
    const id = references.get((node as jsep.Identifier).name)
    if (id) return { aliasId: id }
  }
  if (node.type === 'UnaryExpression') {
    const { operator, argument } = node as jsep.UnaryExpression
    const operand = convert(argument, references, depth + 1)
    if (operator === '+') return { operator: 'MULTIPLY', operands: [1, operand] }
    if (operator === '-' || operator === '!')
      return { operator: operator === '-' ? 'NEGATE' : 'NOT', operands: [operand] }
  }
  if (node.type === 'BinaryExpression') {
    const binary = node as jsep.BinaryExpression
    const operands = [
      convert(binary.left, references, depth + 1),
      convert(binary.right, references, depth + 1)
    ]
    if (binary.operator === 'NAND' || binary.operator === 'NOR')
      return {
        operator: 'NOT',
        operands: [{ operator: binary.operator === 'NAND' ? 'AND' : 'OR', operands }]
      }
    const operator = BINARY.get(binary.operator)
    if (operator) return { operator, operands }
  }
  throw new VariableFormulaError(`Unsupported formula syntax: ${node.type}`)
}

/** Braced references are resolved before parsing; no JavaScript code is executed. */
export function parseFormulaSyntax(
  source: string,
  reference: (name: string) => string
): VariableFormulaNode {
  if (!source.trim()) throw new VariableFormulaError('Enter a formula')
  if (source.length > MAX_FORMULA_LENGTH) throw new VariableFormulaError('Formula is too long')
  const references = new Map<string, string>()
  const substituted = source.replace(
    /\{([^{}]+)\}|[A-Za-z_$][\w$]*/g,
    (match, name: string | undefined) => {
      if (name !== undefined) {
        const key = `$reference${references.size}`
        references.set(key, reference(name.trim()))
        return key
      }
      const word = match.toUpperCase()
      if (word === 'TRUE' || word === 'FALSE') return word.toLowerCase()
      if (word === 'NOT') return '!'
      if (Object.hasOwn(WORD_PRECEDENCE, word)) return word
      // e/E is permitted only as part of a numeric exponent, checked by jsep below.
      if (/^[eE]\d*$/.test(match)) return match
      throw new VariableFormulaError(`Use {${match}} to reference a variable`)
    }
  )
  let nesting = 0
  for (const char of substituted) {
    if (char === '(' && ++nesting > MAX_FORMULA_DEPTH)
      throw new VariableFormulaError('Formula is too deeply nested')
    if (char === ')') nesting--
  }
  try {
    return convert(parseTree(substituted), references)
  } catch (error) {
    if (error instanceof VariableFormulaError) throw error
    throw new VariableFormulaError(error instanceof Error ? error.message : 'Invalid formula')
  }
}
