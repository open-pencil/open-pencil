import { print } from 'esrap'
import tsx from 'esrap/languages/tsx'

import { isNode, type SyntaxNode } from './estree'

/**
 * JSX attribute strings end at `"`, decode `&` entities, and keep backslashes literally,
 * so the printer's escapes for backslashes and line breaks would change the value. JSX
 * text also treats braces and angle brackets as syntax and trims whitespace at line
 * edges. Anything else is written as a string literal, which the printer escapes.
 */
const LITERAL_ATTRIBUTE = /^[^"&\\\r\n]*$/
const LITERAL_TEXT = /^[^{}<>&\r\n]*$/

export const identifier = (name: string): SyntaxNode => ({ type: 'JSXIdentifier', name })

/** A tag name; a dotted one such as `Switch.Root` is a member of a namespace. */
function tagName(tag: string): SyntaxNode {
  const [first = tag, ...rest] = tag.split('.')
  return rest.reduce<SyntaxNode>(
    (object, property) => ({ type: 'JSXMemberExpression', object, property: identifier(property) }),
    identifier(first)
  )
}

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

/** `{...expression}`, passing an object's properties on as attributes. */
export const spread = (argument: SyntaxNode): SyntaxNode => ({
  type: 'JSXSpreadAttribute',
  argument
})

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
  const name = tagName(tag)
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

/** `<>…</>`: children without an element around them, laid out as an element's are. */
export function fragment(children: SyntaxNode[], depth: number): SyntaxNode {
  return {
    type: 'JSXFragment',
    openingFragment: { type: 'JSXOpeningFragment' },
    closingFragment: { type: 'JSXClosingFragment' },
    children: children.length === 0 ? [] : indented(children, depth)
  }
}

export function printJSX(node: SyntaxNode): string {
  return print(node, tsx({ quotes: 'double' }), { indent: '  ' }).code
}

/** A copy without strings' source spelling, so the printer quotes every string the same way. */
function withoutRawStrings(node: SyntaxNode): SyntaxNode {
  const copy: SyntaxNode = { ...node }
  if (node.type === 'Literal' && typeof node.value === 'string') delete copy.raw
  for (const [key, value] of Object.entries(node)) {
    if (Array.isArray(value))
      copy[key] = value.map((item: unknown) => (isNode(item) ? withoutRawStrings(item) : item))
    else if (isNode(value)) copy[key] = withoutRawStrings(value)
  }
  return copy
}

/**
 * A TSX module, such as a component built with `es` templates and JSX from this module. Strings
 * parsed from a template and strings built here print with the same double quotes.
 */
export function printModule(program: SyntaxNode): string {
  return print(withoutRawStrings(program), tsx({ quotes: 'double' }), { indent: '  ' }).code
}
