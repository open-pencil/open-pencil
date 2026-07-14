export type NumberExpressionError =
  | 'empty'
  | 'syntax'
  | 'non-finite'
  | 'percent-requires-finite-max'
  | 'relative-requires-value'

export type NumberExpressionResult =
  | { ok: true; value: number; kind: 'absolute' | 'relative' | 'percent' }
  | { ok: false; error: NumberExpressionError }

export interface NumberExpressionOptions {
  current: number
  max?: number
  mixed?: boolean
}

class ArithmeticParser {
  private index = 0

  constructor(private readonly source: string) {}

  parse(): number {
    const value = this.parseExpression()
    this.skipWhitespace()
    if (this.index !== this.source.length) throw new Error('Unexpected trailing input')
    return value
  }

  private parseExpression(): number {
    let value = this.parseTerm()
    this.skipWhitespace()
    let operator = this.source[this.index]
    while (operator === '+' || operator === '-') {
      this.index += 1
      const right = this.parseTerm()
      value = operator === '+' ? value + right : value - right
      this.skipWhitespace()
      operator = this.source[this.index]
    }
    return value
  }

  private parseTerm(): number {
    let value = this.parseUnary()
    this.skipWhitespace()
    let operator = this.source[this.index]
    while (operator === '*' || operator === '/') {
      this.index += 1
      const right = this.parseUnary()
      value = operator === '*' ? value * right : value / right
      this.skipWhitespace()
      operator = this.source[this.index]
    }
    return value
  }

  private parseUnary(): number {
    this.skipWhitespace()
    const operator = this.source[this.index]
    if (operator !== '+' && operator !== '-') return this.parsePrimary()
    this.index += 1
    const value = this.parseUnary()
    return operator === '-' ? -value : value
  }

  private parsePrimary(): number {
    this.skipWhitespace()
    if (this.source[this.index] === '(') {
      this.index += 1
      const value = this.parseExpression()
      this.skipWhitespace()
      if (this.source[this.index] !== ')') throw new Error('Missing closing parenthesis')
      this.index += 1
      return value
    }

    const match = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i.exec(this.source.slice(this.index))
    if (!match) throw new Error('Expected number')
    this.index += match[0].length
    return Number(match[0])
  }

  private skipWhitespace() {
    while (/\s/.test(this.source[this.index] ?? '')) this.index += 1
  }
}

function evaluateArithmetic(source: string): NumberExpressionResult {
  try {
    const value = new ArithmeticParser(source).parse()
    return Number.isFinite(value)
      ? { ok: true, value, kind: 'absolute' }
      : { ok: false, error: 'non-finite' }
  } catch {
    return { ok: false, error: 'syntax' }
  }
}

export function evaluateNumberExpression(
  expression: string,
  { current, max = Infinity, mixed = false }: NumberExpressionOptions
): NumberExpressionResult {
  const source = expression.trim()
  if (!source) return { ok: false, error: 'empty' }

  if (source.endsWith('%')) {
    if (!Number.isFinite(max)) return { ok: false, error: 'percent-requires-finite-max' }
    const percentage = evaluateArithmetic(source.slice(0, -1))
    if (!percentage.ok) return percentage
    const value = (max * percentage.value) / 100
    return Number.isFinite(value)
      ? { ok: true, value, kind: 'percent' }
      : { ok: false, error: 'non-finite' }
  }

  const relative = /^[+\-*/]/.test(source)
  if (relative && mixed) return { ok: false, error: 'relative-requires-value' }
  if (relative && !Number.isFinite(current)) return { ok: false, error: 'non-finite' }

  const result = evaluateArithmetic(relative ? `(${current})${source}` : source)
  return result.ok ? { ...result, kind: relative ? 'relative' : 'absolute' } : result
}

export function clampNumberValue(value: number, min = -Infinity, max = Infinity): number {
  return Math.min(max, Math.max(min, value))
}

export function normalizeNumberValue(value: number): number {
  return Number.isFinite(value) ? Number.parseFloat(value.toPrecision(14)) : value
}

export function stepNumberValue(
  value: number,
  direction: 1 | -1,
  step: number,
  modifiers: { shiftKey?: boolean; altKey?: boolean } = {},
  min = -Infinity,
  max = Infinity
): number {
  const multiplier = (modifiers.shiftKey ? 10 : 1) * (modifiers.altKey ? 0.1 : 1)
  return clampNumberValue(normalizeNumberValue(value + direction * step * multiplier), min, max)
}
