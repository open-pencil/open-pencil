import { parseExpressionAt, type Expression, type ObjectExpression } from 'acorn'

const MAX_LITERAL_DEPTH = 32
const UNSUPPORTED = Symbol('unsupported-literal')

type LiteralValue =
  | string
  | number
  | boolean
  | null
  | LiteralValue[]
  | { [key: string]: LiteralValue }
type Result = LiteralValue | typeof UNSUPPORTED

/** Decode data only. Calls, getters, spreads, identifiers and computed keys never execute. */
export function readLiteral(source: string): { value: LiteralValue } | null {
  try {
    const expression = parseExpressionAt(source, 0, { ecmaVersion: 'latest' })
    if (source.slice(expression.end).trim()) return null
    const value = evaluateLiteral(expression, 0)
    return value === UNSUPPORTED ? null : { value }
  } catch {
    return null
  }
}

function evaluateLiteral(expression: Expression, depth: number): Result {
  if (depth > MAX_LITERAL_DEPTH) return UNSUPPORTED
  switch (expression.type) {
    case 'Literal': {
      const value = expression.value
      return value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))
        ? value
        : UNSUPPORTED
    }
    case 'UnaryExpression': {
      if (expression.operator !== '-' && expression.operator !== '+') return UNSUPPORTED
      const value = evaluateLiteral(expression.argument, depth + 1)
      if (typeof value !== 'number') return UNSUPPORTED
      return expression.operator === '-' ? -value : value
    }
    case 'ArrayExpression': {
      const values: LiteralValue[] = []
      for (const element of expression.elements) {
        if (!element || element.type === 'SpreadElement') return UNSUPPORTED
        const value = evaluateLiteral(element, depth + 1)
        if (value === UNSUPPORTED) return UNSUPPORTED
        values.push(value)
      }
      return values
    }
    case 'ObjectExpression':
      return evaluateObject(expression, depth)
    default:
      return UNSUPPORTED
  }
}

function evaluateObject(expression: ObjectExpression, depth: number): Result {
  const entries: [string, LiteralValue][] = []
  for (const property of expression.properties) {
    if (
      property.type !== 'Property' ||
      property.computed ||
      property.method ||
      property.shorthand ||
      property.kind !== 'init'
    )
      return UNSUPPORTED
    let key: unknown
    if (property.key.type === 'Identifier') key = property.key.name
    else if (property.key.type === 'Literal') key = property.key.value
    if (typeof key !== 'string' && typeof key !== 'number') return UNSUPPORTED
    const value = evaluateLiteral(property.value, depth + 1)
    if (value === UNSUPPORTED) return UNSUPPORTED
    entries.push([String(key), value])
  }
  return Object.fromEntries(entries)
}
