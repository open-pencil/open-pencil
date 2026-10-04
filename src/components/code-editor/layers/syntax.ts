import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import type { ChangeSpec, EditorState } from '@codemirror/state'

import type { LinkedElement } from './links'

export type SyntaxNode = ReturnType<typeof syntaxTree>['topNode']

/**
 * Expression nodes that make a value a literal: numbers, strings, booleans, negative numbers,
 * and objects or arrays of those. Anything else is the author's expression and is never
 * overwritten.
 */
const LITERAL_NODES = new Set([
  'Number',
  'String',
  'BooleanLiteral',
  'null',
  'UnaryExpression',
  'ArithOp',
  'ObjectExpression',
  'ArrayExpression',
  'Property',
  'PropertyDefinition',
  'PropertyName',
  '{',
  '}',
  '[',
  ']',
  ',',
  ':'
])

export function isLiteralAttribute(attribute: SyntaxNode): boolean {
  const value = attribute.getChild('JSXEscape')
  if (!value) return true
  let literal = true
  value.cursor().iterate((node) => {
    if (node.from === value.from && node.name === 'JSXEscape') return true
    if (!LITERAL_NODES.has(node.name)) literal = false
    return literal
  })
  return literal
}

export function openingTagOf(element: SyntaxNode): SyntaxNode | null {
  return element.getChild('JSXOpenTag') ?? element.getChild('JSXSelfClosingTag')
}

export function attributeName(state: EditorState, attribute: SyntaxNode): string {
  const name = attribute.firstChild
  return name ? state.doc.sliceString(name.from, name.to) : ''
}

/** The syntax node of a linked element, if the code there is still that element. */
export function elementNode(state: EditorState, element: LinkedElement): SyntaxNode | null {
  const tree = ensureSyntaxTree(state, state.doc.length, 250) ?? syntaxTree(state)
  let node: SyntaxNode | null = tree.resolveInner(element.nameFrom, 1)
  while (node && node.name !== 'JSXElement') node = node.parent
  return node && node.from === element.from && node.to === element.to ? node : null
}

export function indentAt(state: EditorState, pos: number): string {
  return /^\s*/.exec(state.doc.lineAt(pos).text)?.[0] ?? ''
}

export function reindent(code: string, indent: string): string {
  return code
    .split('\n')
    .map((line, index) => (index === 0 || !line ? line : indent + line))
    .join('\n')
}

/** Removes a range and, when it is alone on its line, the line with it. */
export function removal(state: EditorState, from: number, to: number): ChangeSpec {
  const first = state.doc.lineAt(from)
  const last = state.doc.lineAt(to)
  const aloneOnLine =
    !first.text.slice(0, from - first.from).trim() && !last.text.slice(to - last.from).trim()
  if (!aloneOnLine) return { from, to }
  if (first.number > 1) return { from: first.from - 1, to: last.to }
  return { from: first.from, to: Math.min(last.to + 1, state.doc.length) }
}
