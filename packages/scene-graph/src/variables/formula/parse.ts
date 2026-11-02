import { tryParseColor } from '#scene-graph/color/index'
import type { Color } from '#scene-graph/primitives'
import type { VariableFormulaNode, VariableFormulaOperator } from '#scene-graph/types'
import * as v from 'valibot'

import { checkFormulaOperands } from './check'
import {
  binaryFormulaOperator,
  formulaCallOperator,
  formulaPrecedence,
  FORMULA_NON_ASSOCIATIVE,
  FORMULA_PREFIX_PRECEDENCE,
  prefixFormulaOperator,
  type FormulaValueType
} from './signatures'
import { formulaTokenName, formulaTokens, type FormulaToken } from './tokens'
import { MAX_FORMULA_DEPTH, MAX_FORMULA_LENGTH, VariableFormulaError } from './tree'

/*
 * A small Pratt parser rather than a library. jsep configures operators globally, which the calc
 * tool's grammar already relies on, and gives no token stream for the editor to highlight and
 * complete from. A Lezer grammar would add its runtime (about 18 KB gzipped) to every Scene Graph
 * consumer, and its generic error recovery would still need these type and arity messages.
 */

/** Check what the editor may leave open while typing, which a saved formula cannot hold. */
function checkedTokens(source: string): FormulaToken[] {
  const tokens = formulaTokens(source)
  for (const token of tokens) {
    if (token.kind === 'invalid') throw new VariableFormulaError(`Unexpected ${token.text}`)
    if (token.kind === 'string' && (token.text.length < 2 || !token.text.endsWith('"')))
      throw new VariableFormulaError('A text is missing its closing "')
    if (token.kind !== 'reference') continue
    if (!token.text.endsWith('}'))
      throw new VariableFormulaError('A reference is missing its closing }')
    if (!formulaTokenName(token)) throw new VariableFormulaError('Empty variable reference')
  }
  return tokens
}

/** A quoted string's text, read with JSON's escapes, as Figma reads it. */
function stringValue(token: FormulaToken): string {
  const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), v.string()), token.text)
  if (!parsed.success) throw new VariableFormulaError(`Invalid text ${token.text}`)
  return parsed.output
}

/** `#RRGGBB`, or `#RRGGBBAA` with opacity. */
function colorValue(token: FormulaToken): Color {
  const color = tryParseColor(token.text)
  if (!color) throw new VariableFormulaError(`Invalid color ${token.text}`)
  return color
}

export interface FormulaReference {
  id: string
  type: FormulaValueType
}

export interface ParsedFormula {
  node: VariableFormulaNode
  type: FormulaValueType
}

/**
 * Read a formula into Figma's expression tree, checking operand types on the way. References
 * are `{name}` or a bare name; `reference` resolves them. No code is evaluated.
 */
export function parseFormulaSyntax(
  source: string,
  reference: (name: string) => FormulaReference
): ParsedFormula {
  if (!source.trim()) throw new VariableFormulaError('Enter a value or formula')
  if (source.length > MAX_FORMULA_LENGTH) throw new VariableFormulaError('Formula is too long')
  const tokens = checkedTokens(source)
  let index = 0
  const peek = () => tokens.at(index)
  /** Operators and keywords by their lowercase spelling; operands read as nothing. */
  const symbolAt = (token: FormulaToken | undefined) =>
    token && ['operator', 'keyword', 'paren', 'bool'].includes(token.kind)
      ? token.text.toLowerCase()
      : ''

  function operation(operator: VariableFormulaOperator, operands: ParsedFormula[]): ParsedFormula {
    const type = checkFormulaOperands(
      operator,
      operands.map((operand) => operand.type)
    )
    return { node: { operator, operands: operands.map((operand) => operand.node) }, type }
  }

  /** A call's operands, `(a, b)`, after its name. */
  function call(operator: VariableFormulaOperator, name: string, depth: number): ParsedFormula {
    if (symbolAt(tokens.at(index++)) !== '(') throw new VariableFormulaError(`Write ${name}(…)`)
    const operands: ParsedFormula[] = []
    if (symbolAt(peek()) !== ')') {
      operands.push(expression(0, depth + 1))
      while (peek()?.kind === 'comma') {
        index++
        operands.push(expression(0, depth + 1))
      }
    }
    if (symbolAt(tokens.at(index++)) !== ')') throw new VariableFormulaError('Missing )')
    return operation(operator, operands)
  }

  function prefix(depth: number): ParsedFormula {
    if (depth > MAX_FORMULA_DEPTH) throw new VariableFormulaError('Formula is too deeply nested')
    const token = tokens.at(index++)
    if (!token) throw new VariableFormulaError('The formula ends too early')
    if (token.kind === 'number') return { node: Number(token.text), type: 'FLOAT' }
    if (token.kind === 'string') return { node: stringValue(token), type: 'STRING' }
    if (token.kind === 'color') return { node: colorValue(token), type: 'COLOR' }
    const callee = token.kind === 'function' ? formulaCallOperator(token.text) : undefined
    if (callee) return call(callee, token.text.toLowerCase(), depth)
    if (token.kind === 'reference' || token.kind === 'name') {
      const { id, type } = reference(formulaTokenName(token))
      return { node: { aliasId: id }, type }
    }
    switch (symbolAt(token)) {
      case 'true':
      case 'false':
        return { node: symbolAt(token) === 'true', type: 'BOOLEAN' }
      case '(': {
        const inner = expression(0, depth + 1)
        if (symbolAt(tokens.at(index++)) !== ')') throw new VariableFormulaError('Missing )')
        return inner
      }
      case '+':
        return prefix(depth + 1)
    }
    const operator = prefixFormulaOperator(symbolAt(token))
    if (!operator) throw new VariableFormulaError(`Unexpected ${token.text}`)
    const operand = expression(FORMULA_PREFIX_PRECEDENCE, depth + 1)
    // A negative number is a literal, not the negation of one.
    if (operator === 'negate' && typeof operand.node === 'number')
      return { node: -operand.node, type: 'FLOAT' }
    return operation(operator, [operand])
  }

  function expression(minimum: number, depth: number): ParsedFormula {
    let left = prefix(depth)
    for (;;) {
      const operator = binaryFormulaOperator(symbolAt(peek()))
      const precedence = operator ? (formulaPrecedence(operator) ?? 0) : 0
      if (!operator || precedence <= minimum) return left
      index++
      const right = expression(precedence, depth + 1)
      left = operation(operator, [left, right])
      const next = binaryFormulaOperator(symbolAt(peek()))
      if (next && FORMULA_NON_ASSOCIATIVE.has(precedence) && formulaPrecedence(next) === precedence)
        throw new VariableFormulaError('Join comparisons with and or or')
    }
  }

  const result = expression(0, 0)
  const extra = peek()
  if (extra) throw new VariableFormulaError(`Unexpected ${formulaTokenName(extra)}`)
  return result
}
