import valueParser, { type Node } from 'postcss-value-parser'

import type {
  VariableFormulaNode,
  VariableFormulaOperation,
  VariableFormulaOperator
} from '@open-pencil/scene-graph'
import { foldFormula, isFormulaOperation } from '@open-pencil/scene-graph/variables'

const OPERATORS: Record<string, VariableFormulaOperator> = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  '/': 'divide'
}
const SUMS = new Set(['+', '-'])
const PRODUCTS = new Set(['*', '/'])

/** Units a formula can hold as plain numbers: a pixel is a layer's unit, and a number has none. */
const PLAIN_UNITS = new Set(['', 'px'])

/** What a part of `calc()` is: an operator, or what it operates on. */
type Part = { operator: string } | { node: Node }

function partsOf(nodes: readonly Node[]): Part[] | null {
  const parts: Part[] = []
  for (const node of nodes) {
    if (node.type === 'space' || node.type === 'comment') continue
    if (node.type === 'div' && node.value === '/') parts.push({ operator: '/' })
    else if (node.type === 'word' && node.value in OPERATORS) parts.push({ operator: node.value })
    else if (node.type === 'word' || node.type === 'function') parts.push({ node })
    else return null
  }
  return parts
}

/**
 * Reads `calc()` as a formula, given the variable each custom property is; null when it holds
 * anything a variable cannot compute, such as a percentage or a property with no variable.
 */
class FormulaReader {
  readonly #variableOf: (property: string) => string | undefined

  constructor(variableOf: (property: string) => string | undefined) {
    this.#variableOf = variableOf
  }

  /** `a + b - c`, each a product, left to right. */
  sum(parts: readonly Part[]): VariableFormulaNode | null {
    return this.#chain(parts, SUMS, (product) => this.#product(product))
  }

  /** `a * b / c`, each a value, left to right. */
  #product(parts: readonly Part[]): VariableFormulaNode | null {
    return this.#chain(parts, PRODUCTS, (value) => {
      const part = value.length === 1 ? value[0] : undefined
      return part && 'node' in part ? this.#value(part.node) : null
    })
  }

  #chain(
    parts: readonly Part[],
    operators: ReadonlySet<string>,
    read: (parts: readonly Part[]) => VariableFormulaNode | null
  ): VariableFormulaNode | null {
    const at = parts.findLastIndex((part) => 'operator' in part && operators.has(part.operator))
    if (at === -1) return read(parts)
    const split = parts[at]
    if (!('operator' in split)) return null
    const left = this.#chain(parts.slice(0, at), operators, read)
    const right = read(parts.slice(at + 1))
    if (!left || !right) return null
    return { operator: OPERATORS[split.operator], operands: [left, right] }
  }

  #value(node: Node): VariableFormulaNode | null {
    if (node.type === 'word') {
      const number = valueParser.unit(node.value)
      return number && PLAIN_UNITS.has(number.unit.toLowerCase()) ? Number(number.number) : null
    }
    if (node.type !== 'function') return null
    const name = node.value.toLowerCase()
    if (name === 'var') {
      // A fallback is never used while the property has a variable, which it must to be read.
      const property = node.nodes.at(0)
      const id = property?.type === 'word' ? this.#variableOf(property.value) : undefined
      return id ? { aliasId: id } : null
    }
    if (name !== 'calc' && name !== '') return null
    const parts = partsOf(node.nodes)
    return parts ? this.sum(parts) : null
  }
}

/**
 * `calc(var(--spacing) * 4)` as the formula `spacing * 4`, given the number variable each custom
 * property is; null for any other value, a `calc()` a variable cannot compute, or one that names
 * no variable.
 */
export function cssFormula(
  text: string,
  variableOf: (property: string) => string | undefined
): VariableFormulaOperation | null {
  const nodes = valueParser(text.trim()).nodes
  const [calc] = nodes
  if (nodes.length !== 1 || calc.type !== 'function' || calc.value.toLowerCase() !== 'calc')
    return null
  const parts = partsOf(calc.nodes)
  const formula = parts ? new FormulaReader(variableOf).sum(parts) : null
  if (!formula || !isFormulaOperation(formula)) return null
  // `calc(4px * 2)` computes nothing from a variable.
  const refers = foldFormula<boolean>(formula, {
    literal: () => false,
    reference: () => true,
    operation: (_, operands) => operands.some(Boolean)
  })
  return refers ? formula : null
}
