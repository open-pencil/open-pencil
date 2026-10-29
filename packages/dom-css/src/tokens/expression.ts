import valueParser, { type Node } from 'postcss-value-parser'

import type { TokenUnit } from '@open-pencil/scene-graph'

import { parseCSSName } from './names'
import type { TokenValidator } from './validate'
import { TOKEN_UNIT_PROPERTY } from './values'

/**
 * What a piece of a CSS value is. A finished `var(--name)` is one `reference`; while it is typed
 * it reads as a `function`, a `paren` and a `property`, the custom property name.
 */
export type CSSValueTokenKind =
  | 'reference'
  | 'property'
  | 'function'
  | 'paren'
  | 'number'
  | 'operator'
  | 'separator'
  | 'string'
  | 'keyword'

export interface CSSValueToken {
  kind: CSSValueTokenKind
  text: string
  from: number
  to: number
}

const OPERATORS = new Set(['+', '-', '*', '/'])

/** `var(--name)` with nothing else inside, which an editor can show as the variable it names. */
function isReference(node: valueParser.FunctionNode) {
  if (node.value !== 'var' || node.unclosed || node.nodes.length !== 1) return false
  const [argument] = node.nodes
  return argument.type === 'word' && argument.value.startsWith('--')
}

function wordKind(word: string): CSSValueTokenKind {
  if (word.startsWith('--')) return 'property'
  if (OPERATORS.has(word)) return 'operator'
  return valueParser.unit(word) ? 'number' : 'keyword'
}

/**
 * The tokens of one CSS value, such as `clamp(1rem, 4vw, var(--space-md))`, in order and with
 * their source ranges. Reading tolerates half-typed values: an unclosed function still gives
 * its name and its `(`.
 */
export function cssValueTokens(source: string): CSSValueToken[] {
  const tokens: CSSValueToken[] = []
  const push = (kind: CSSValueTokenKind, from: number, to: number) =>
    tokens.push({ kind, text: source.slice(from, to), from, to })
  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      if (node.type === 'function') {
        if (isReference(node)) {
          push('reference', node.sourceIndex, node.sourceEndIndex)
          continue
        }
        const open = node.sourceIndex + node.value.length
        if (node.value) push('function', node.sourceIndex, open)
        push('paren', open, open + 1)
        walk(node.nodes)
        if (!node.unclosed) push('paren', node.sourceEndIndex - 1, node.sourceEndIndex)
      } else if (node.type === 'word') {
        push(wordKind(node.value), node.sourceIndex, node.sourceEndIndex)
      } else if (node.type === 'div') {
        push(node.value === '/' ? 'operator' : 'separator', node.sourceIndex, node.sourceEndIndex)
      } else if (node.type === 'string') {
        push('string', node.sourceIndex, node.sourceEndIndex)
      }
    }
  }
  walk(valueParser(source).nodes)
  return tokens
}

/** The custom property a token names, in `var(--name)` or as a bare `--name`. */
export function cssTokenProperty(token: CSSValueToken): string | undefined {
  if (token.kind !== 'reference' && token.kind !== 'property') return undefined
  const name = parseCSSName(token.text)
  return name ? `--${name}` : undefined
}

function hasUnclosedFunction(nodes: Node[]): boolean {
  return nodes.some(
    (node) => node.type === 'function' && (node.unclosed || hasUnclosedFunction(node.nodes))
  )
}

export type CSSExpressionProblem =
  | { kind: 'unclosed' }
  | { kind: 'syntax' }
  | { kind: 'negated-reference'; property: string }
  | { kind: 'unknown-token'; name: string }
  | { kind: 'invalid'; property: string }

/**
 * Why a CSS expression cannot stand in for a token, if it cannot. The token validator checks it
 * is one declaration; then it must name only tokens that exist and suit the token's unit, which
 * `supports` checks where a browser can type values. A value holding `var()` passes that last
 * check until it is used, so only its names are checked.
 */
export function cssExpressionProblem(
  css: string,
  unit: TokenUnit,
  tokens: ReadonlySet<string>,
  validator: TokenValidator,
  supports?: (property: string, value: string) => boolean
): CSSExpressionProblem | undefined {
  if (!validator.declaration('token', css))
    return hasUnclosedFunction(valueParser(css).nodes) ? { kind: 'unclosed' } : { kind: 'syntax' }
  const parsed = cssValueTokens(css)
  // `-var(--x)` reads as a function named `-var`: CSS negates a value only inside calc().
  const negated = parsed.findIndex((token) => token.kind === 'function' && token.text === '-var')
  if (negated !== -1) {
    const property = parsed.slice(negated).map(cssTokenProperty).find(Boolean)
    if (property) return { kind: 'negated-reference', property }
  }
  for (const token of parsed) {
    const name = cssTokenProperty(token)
    if (name && !tokens.has(name)) return { kind: 'unknown-token', name }
  }
  const property = TOKEN_UNIT_PROPERTY[unit]
  return !supports || supports(property, css) ? undefined : { kind: 'invalid', property }
}
