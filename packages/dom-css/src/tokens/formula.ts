import type { Variable, VariableFormulaNode } from '@open-pencil/scene-graph'
import { foldFormula } from '@open-pencil/scene-graph/variables'

import { tokenNumberToCSS, variableUnit } from './values'

/**
 * A number formula as `calc()`, with each reference a `var()`. CSS adds only like with like and
 * multiplies a length only by a plain number, so a literal takes the unit of what it is added
 * to, and a formula CSS cannot type, such as a length times a length, has no CSS form.
 */
type Term =
  | { kind: 'literal'; value: number }
  | { kind: 'css'; text: string; precedence: number; dimension: boolean }

const OPERATORS = {
  add: { symbol: '+', precedence: 1 },
  subtract: { symbol: '-', precedence: 1 },
  multiply: { symbol: '*', precedence: 2 },
  divide: { symbol: '/', precedence: 2 }
} as const
type Arithmetic = keyof typeof OPERATORS
const ATOM = 3

class UnsupportedFormulaError extends Error {
  override name = 'UnsupportedFormulaError'
}

interface FormulaContext {
  variables: ReadonlyMap<string, Variable>
  names: ReadonlyMap<string, string>
  /** A literal written as a length, in the exported token's unit. */
  length: (value: number) => string
}

export function formulaToCSS(
  node: VariableFormulaNode,
  variable: Variable,
  variables: ReadonlyMap<string, Variable>,
  names: ReadonlyMap<string, string>
): string | { issue: string } {
  const unit = variableUnit(variable)
  const context = { variables, names, length: (value: number) => tokenNumberToCSS(value, unit) }
  try {
    const result = convert(node, context)
    const dimension = unit !== 'none'
    if (result.kind === 'literal') return write(result, dimension, context)
    if (result.dimension !== dimension)
      return { issue: dimension ? 'has a formula without a unit' : 'has a formula with a unit' }
    return `calc(${result.text})`
  } catch (error) {
    if (error instanceof UnsupportedFormulaError) return { issue: error.message }
    throw error
  }
}

function convert(node: VariableFormulaNode, context: FormulaContext): Term {
  return foldFormula<Term>(node, {
    literal: (value) => {
      if (typeof value === 'number') return { kind: 'literal', value }
      if (typeof value === 'boolean')
        throw new UnsupportedFormulaError('mixes true/false into a number')
      throw new UnsupportedFormulaError('mixes text or a color into a number')
    },
    reference: (id) => reference(id, context),
    operation: ({ operator }, operands) => {
      const [a, b] = operands
      if (operator === 'negate' && operands.length === 1) return negate(a, context)
      if (operands.length !== 2 || !isArithmetic(operator))
        throw new UnsupportedFormulaError('uses logic that CSS has no form for')
      if (a.kind === 'literal' && b.kind === 'literal')
        return { kind: 'literal', value: fold(operator, a.value, b.value) }
      return binary(operator, a, b, context)
    }
  })
}

function reference(id: string, { variables, names }: FormulaContext): Term {
  const target = variables.get(id)
  const name = names.get(id)
  if (!target || !name)
    throw new UnsupportedFormulaError('refers to a variable that does not exist')
  if (target.type !== 'FLOAT')
    throw new UnsupportedFormulaError('uses a variable that is not a number')
  const dimension = variableUnit(target) !== 'none'
  return { kind: 'css', text: `var(--${name})`, precedence: ATOM, dimension }
}

function negate(term: Term, context: FormulaContext): Term {
  if (term.kind === 'literal') return { kind: 'literal', value: -term.value }
  const text = `-1 * ${grouped(term, false, OPERATORS.multiply.precedence, context)}`
  return { kind: 'css', text, precedence: OPERATORS.multiply.precedence, dimension: term.dimension }
}

function binary(operator: Arithmetic, a: Term, b: Term, context: FormulaContext): Term {
  const { symbol, precedence } = OPERATORS[operator]
  // The right side of - and / keeps its parentheses even at equal precedence.
  const rightBelow = operator === 'subtract' || operator === 'divide' ? precedence + 1 : precedence
  const aDimension = a.kind === 'css' && a.dimension
  const bDimension = b.kind === 'css' && b.dimension
  if (precedence === 1) {
    if (a.kind === 'css' && b.kind === 'css' && aDimension !== bDimension)
      throw new UnsupportedFormulaError('adds a length to a plain number')
    const dimension = aDimension || bDimension
    const left = grouped(a, dimension, precedence, context)
    const right = grouped(b, dimension, rightBelow, context)
    return { kind: 'css', text: `${left} ${symbol} ${right}`, precedence, dimension }
  }
  if (bDimension && operator === 'divide') throw new UnsupportedFormulaError('divides by a length')
  if (aDimension && bDimension) throw new UnsupportedFormulaError('multiplies two lengths')
  const left = grouped(a, false, precedence, context)
  const right = grouped(b, false, rightBelow, context)
  return {
    kind: 'css',
    text: `${left} ${symbol} ${right}`,
    precedence,
    dimension: aDimension || bDimension
  }
}

function write(term: Term, dimension: boolean, context: FormulaContext) {
  if (term.kind === 'css') return term.text
  return dimension ? context.length(term.value) : String(Number(term.value.toFixed(6)))
}

function grouped(term: Term, dimension: boolean, below: number, context: FormulaContext) {
  return term.kind === 'css' && term.precedence < below
    ? `(${term.text})`
    : write(term, dimension, context)
}

function isArithmetic(operator: string): operator is Arithmetic {
  return Object.hasOwn(OPERATORS, operator)
}

function fold(operator: Arithmetic, a: number, b: number) {
  if (operator === 'add') return a + b
  if (operator === 'subtract') return a - b
  if (operator === 'multiply') return a * b
  return a / b
}
