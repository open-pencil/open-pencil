import { formulaCallOperator, FORMULA_KEYWORDS } from './signatures'

/**
 * What a piece of formula text is. `reference` is a braced `{name}` and `string` a quoted
 * `"text"`, either of which may still be open while it is typed; `name` is a bare word that
 * names a variable; `function` is a call's name, such as `if`; `invalid` is any character the
 * syntax has no place for.
 */
export type FormulaTokenKind =
  | 'number'
  | 'string'
  | 'color'
  | 'reference'
  | 'name'
  | 'function'
  | 'keyword'
  | 'bool'
  | 'operator'
  | 'paren'
  | 'comma'
  | 'invalid'

export interface FormulaToken {
  kind: FormulaTokenKind
  text: string
  from: number
  to: number
}

const NUMBER = /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/y
const WORD = /[\p{L}_$][\p{L}\p{N}_$]*/uy
const OPERATOR = /<=|>=|==|!=|&&|\|\||[-+*/<>!]/y
const SPACE = /\s+/y
const COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})(?![\p{L}\p{N}_$])/uy
const BOOLEANS = new Set(['true', 'false'])

function matchAt(pattern: RegExp, source: string, at: number) {
  pattern.lastIndex = at
  return pattern.exec(source)?.[0]
}

/** A string runs to its unescaped closing quote, or, while it is still being typed, to the end. */
function stringEnd(source: string, at: number) {
  for (let index = at + 1; index < source.length; index++) {
    if (source[index] === '\\') index++
    else if (source[index] === '"') return index + 1
  }
  return source.length
}

/** A reference runs to its `}`, or, while it is still being typed, to the next `{` or the end. */
function referenceEnd(source: string, at: number) {
  for (let index = at + 1; index < source.length; index++) {
    if (source[index] === '}') return index + 1
    if (source[index] === '{') return index
  }
  return source.length
}

function wordKind(word: string): FormulaTokenKind {
  const lower = word.toLowerCase()
  if (FORMULA_KEYWORDS.has(lower)) return 'keyword'
  if (formulaCallOperator(lower)) return 'function'
  return BOOLEANS.has(lower) ? 'bool' : 'name'
}

/**
 * The token that starts at `at`, which must not be whitespace. Reading never fails: text the
 * syntax has no place for is an `invalid` token, so an editor can highlight what a parser rejects.
 */
export function readFormulaToken(source: string, at: number): FormulaToken {
  const token = (kind: FormulaTokenKind, length: number): FormulaToken => ({
    kind,
    text: source.slice(at, at + length),
    from: at,
    to: at + length
  })
  const char = source[at] ?? ''
  if (char === '{') return token('reference', referenceEnd(source, at) - at)
  if (char === '"') return token('string', stringEnd(source, at) - at)
  if (char === '(' || char === ')') return token('paren', 1)
  if (char === ',') return token('comma', 1)
  const color = matchAt(COLOR, source, at)
  if (color) return token('color', color.length)
  const number = matchAt(NUMBER, source, at)
  if (number) return token('number', number.length)
  const word = matchAt(WORD, source, at)
  if (word) return token(wordKind(word), word.length)
  const operator = matchAt(OPERATOR, source, at)
  return operator ? token('operator', operator.length) : token('invalid', 1)
}

/** Every token of a formula, in order, without the whitespace between them. */
export function formulaTokens(source: string): FormulaToken[] {
  const tokens: FormulaToken[] = []
  let at = 0
  while (at < source.length) {
    const space = matchAt(SPACE, source, at)
    if (space) {
      at += space.length
      continue
    }
    const token = readFormulaToken(source, at)
    tokens.push(token)
    at = token.to
  }
  return tokens
}

/** The variable a reference or bare name gives, without braces or surrounding spaces. */
export function formulaTokenName(token: FormulaToken) {
  if (token.kind !== 'reference') return token.text
  return token.text.slice(1, token.text.endsWith('}') ? -1 : undefined).trim()
}
