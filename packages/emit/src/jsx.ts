import { print } from 'esrap'
import tsx from 'esrap/languages/tsx'

import type { SyntaxNode } from './estree'

/**
 * JSX attribute strings end at `"`, decode `&` entities, and keep backslashes literally,
 * so the printer's escapes for backslashes and line breaks would change the value. JSX
 * text also treats braces and angle brackets as syntax and trims whitespace at line
 * edges. Anything else is written as a string literal, which the printer escapes.
 */
const LITERAL_ATTRIBUTE = /^[^"&\\\r\n]*$/
const LITERAL_TEXT = /^[^{}<>&\r\n]*$/

export const identifier = (name: string): SyntaxNode => ({ type: 'JSXIdentifier', name })

export const literal = (value: string | number | boolean): SyntaxNode => ({
  type: 'Literal',
  value
})

export const container = (expression: SyntaxNode): SyntaxNode => ({
  type: 'JSXExpressionContainer',
  expression
})

/** Raw JSX text, printed as is. */
export const whitespace = (value: string): SyntaxNode => ({ type: 'JSXText', value, raw: value })

/** A string attribute value: quoted when JSX keeps it as written, an expression otherwise. */
export const stringValue = (value: string): SyntaxNode =>
  LITERAL_ATTRIBUTE.test(value) ? literal(value) : container(literal(value))

/** An attribute; a null value prints the bare name, as for `true`. */
export const attribute = (name: string, value: SyntaxNode | null): SyntaxNode => ({
  type: 'JSXAttribute',
  name: identifier(name),
  value
})

/** Text content: plain JSX text when it survives as written, a string expression otherwise. */
export function text(value: string): SyntaxNode {
  const plain = LITERAL_TEXT.test(value) && value.trim() === value && value.length > 0
  return plain ? whitespace(value) : container(literal(value))
}

/** Children on their own lines; JSX drops whitespace-only lines between elements. */
function indented(children: SyntaxNode[], depth: number): SyntaxNode[] {
  const inner = `\n${'  '.repeat(depth + 1)}`
  return [
    ...children.flatMap((child) => [whitespace(inner), child]),
    whitespace(`\n${'  '.repeat(depth)}`)
  ]
}

/**
 * An element at nesting `depth`. Children go on their own lines unless `inline`, as for a
 * lone text child; without children the element self-closes.
 */
export function element(
  tag: string,
  attributes: SyntaxNode[],
  children: SyntaxNode[],
  depth: number,
  inline = false
): SyntaxNode {
  const name = identifier(tag)
  const content = inline || children.length === 0 ? children : indented(children, depth)
  return {
    type: 'JSXElement',
    openingElement: {
      type: 'JSXOpeningElement',
      name,
      attributes,
      selfClosing: content.length === 0
    },
    closingElement: content.length > 0 ? { type: 'JSXClosingElement', name } : null,
    children: content
  }
}

export function printJSX(node: SyntaxNode): string {
  return print(node, tsx({ quotes: 'double' }), { indent: '  ' }).code
}
