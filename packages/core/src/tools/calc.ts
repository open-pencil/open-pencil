import { defineTool } from './schema'

/**
 * Recursive descent parser for safe arithmetic expressions.
 * Supports: + - * / % ** ( ) and Math.min/max/floor/ceil/round/abs/sqrt/pow
 */

const MATH_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  'Math.min': (...args) => Math.min(...args),
  'Math.max': (...args) => Math.max(...args),
  'Math.floor': (n) => Math.floor(n),
  'Math.ceil': (n) => Math.ceil(n),
  'Math.round': (n) => Math.round(n),
  'Math.abs': (n) => Math.abs(n),
  'Math.sqrt': (n) => Math.sqrt(n),
  'Math.pow': (base, exp) => Math.pow(base, exp),
}

class Parser {
  private pos = 0
  constructor(private input: string) {}

  parse(): number {
    this.skipWhitespace()
    const result = this.parseAddSub()
    this.skipWhitespace()
    if (this.pos < this.input.length) {
      throw new Error(`Unexpected character '${this.input[this.pos]}' at position ${this.pos}`)
    }
    return result
  }

  private parseAddSub(): number {
    let left = this.parseMulDiv()
    this.skipWhitespace()
    while (this.pos < this.input.length && (this.peek() === '+' || this.peek() === '-')) {
      const op = this.advance()
      const right = this.parseMulDiv()
      left = op === '+' ? left + right : left - right
      this.skipWhitespace()
    }
    return left
  }

  private parseMulDiv(): number {
    let left = this.parseExponent()
    this.skipWhitespace()
    while (this.pos < this.input.length && (this.peek() === '*' || this.peek() === '/' || this.peek() === '%')) {
      const op = this.advance()
      const right = this.parseExponent()
      if (op === '*') left *= right
      else if (op === '/') left /= right
      else left %= right
      this.skipWhitespace()
    }
    return left
  }

  private parseExponent(): number {
    let base = this.parseUnary()
    this.skipWhitespace()
    if (this.pos < this.input.length - 1 && this.input[this.pos] === '*' && this.input[this.pos + 1] === '*') {
      this.pos += 2
      const exp = this.parseUnary()
      base = base ** exp
    }
    return base
  }

  private parseUnary(): number {
    this.skipWhitespace()
    if (this.peek() === '-') {
      this.advance()
      return -this.parseUnary()
    }
    if (this.peek() === '+') {
      this.advance()
      return this.parseUnary()
    }
    return this.parsePrimary()
  }

  private parsePrimary(): number {
    this.skipWhitespace()

    if (this.peek() === '(') {
      this.advance()
      const val = this.parseAddSub()
      this.skipWhitespace()
      this.expect(')')
      return val
    }

    if (this.input.startsWith('Math.', this.pos)) {
      return this.parseMathFunction()
    }

    return this.parseNumber()
  }

  private parseMathFunction(): number {
    const start = this.pos
    while (this.pos < this.input.length && /[A-Za-z.]/.test(this.input[this.pos])) {
      this.pos++
    }
    const name = this.input.slice(start, this.pos)
    const fn = MATH_FUNCTIONS[name]
    if (!fn) throw new Error(`Unknown function: ${name}`)

    this.skipWhitespace()
    this.expect('(')
    const args: number[] = []
    this.skipWhitespace()
    if (this.peek() !== ')') {
      args.push(this.parseAddSub())
      this.skipWhitespace()
      while (this.peek() === ',') {
        this.advance()
        args.push(this.parseAddSub())
        this.skipWhitespace()
      }
    }
    this.expect(')')
    return fn(...args)
  }

  private parseNumber(): number {
    this.skipWhitespace()
    const start = this.pos
    if (this.peek() === '-' || this.peek() === '+') this.pos++
    while (this.pos < this.input.length && /[0-9.]/.test(this.input[this.pos])) {
      this.pos++
    }
    const str = this.input.slice(start, this.pos)
    const num = Number(str)
    if (str.length === 0 || Number.isNaN(num)) {
      throw new Error(`Expected number at position ${start}, got '${this.input.slice(start, start + 10)}'`)
    }
    return num
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++
    }
  }

  private peek(): string {
    return this.input[this.pos] ?? ''
  }

  private advance(): string {
    return this.input[this.pos++] ?? ''
  }

  private expect(ch: string): void {
    if (this.input[this.pos] !== ch) {
      throw new Error(`Expected '${ch}' at position ${this.pos}, got '${this.input[this.pos] ?? 'EOF'}'`)
    }
    this.pos++
  }
}

function evaluate(expr: string): number {
  return new Parser(expr).parse()
}

export const calc = defineTool({
  name: 'calc',
  description:
    'Arithmetic calculator. ALWAYS use this instead of mental math for layout calculations. ' +
    'Evaluates a math expression and returns the numeric result. ' +
    'Examples: "844 - 56 - 96 - 82" → 610, "Math.floor(390 * 0.6)" → 234',
  params: {
    expr: {
      type: 'string',
      description: 'Math expression, e.g. "844 - 56 - 96 - 82" or "Math.min(300, 400 - 2 * 20)"',
      required: true
    }
  },
  execute: (_figma, { expr }) => {
    try {
      const result = evaluate(expr)
      if (!Number.isFinite(result)) {
        return { error: `Expression "${expr}" produced ${String(result)}` }
      }
      return { expr, result }
    } catch (e) {
      return { error: `${e instanceof Error ? e.message : String(e)}` }
    }
  }
})
