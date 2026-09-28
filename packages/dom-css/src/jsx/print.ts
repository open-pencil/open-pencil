import { print } from 'esrap'
import tsx from 'esrap/languages/tsx'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { sceneNodeToDesignDocument } from '../from-scene-graph'
import { mergeClassNames, serializeTailwindClasses } from '../serialize'
import type { DesignDocument, DesignElement, DesignNode } from '../types'

/** A JSX node as esrap prints it. */
interface JSXNode {
  type: string
  [key: string]: unknown
}

/** HTML attribute names that JSX spells differently. */
const JSX_ATTRIBUTE_NAMES: Record<string, string> = { class: 'className', for: 'htmlFor' }

/**
 * JSX attribute strings end at `"`, decode `&` entities, and keep backslashes literally,
 * so the printer's escapes for backslashes and line breaks would change the value. JSX
 * text also treats braces and angle brackets as syntax and trims whitespace at line
 * edges. Anything else is written as a string literal, which the printer escapes.
 */
const LITERAL_ATTRIBUTE = /^[^"&\\\r\n]*$/
const LITERAL_TEXT = /^[^{}<>&\n]*$/

const identifier = (name: string): JSXNode => ({ type: 'JSXIdentifier', name })
const literal = (value: string): JSXNode => ({ type: 'Literal', value })
const expression = (value: string): JSXNode => ({
  type: 'JSXExpressionContainer',
  expression: literal(value)
})
const whitespace = (value: string): JSXNode => ({ type: 'JSXText', value, raw: value })

function attribute(name: string, value: string): JSXNode {
  return {
    type: 'JSXAttribute',
    name: identifier(JSX_ATTRIBUTE_NAMES[name] ?? name),
    value: LITERAL_ATTRIBUTE.test(value) ? literal(value) : expression(value)
  }
}

function text(value: string): JSXNode {
  const plain = LITERAL_TEXT.test(value) && value.trim() === value && value.length > 0
  return plain ? whitespace(value) : expression(value)
}

/** Scene text layers become paragraphs; Tailwind's preflight removes their margins. */
function tagName(node: DesignElement): string {
  return node.sourceSceneNode?.type === 'TEXT' ? 'p' : node.tagName
}

function attributes(node: DesignElement): JSXNode[] {
  const { class: className, ...attrs } = node.attrs
  const name = node.sourceSceneNode?.name
  const entries: [string, string | undefined][] = [
    ['data-name', name && name !== node.sourceSceneNode?.type ? name : undefined],
    ...Object.entries(attrs),
    ['className', mergeClassNames(className, serializeTailwindClasses(node))]
  ]
  return entries.flatMap(([key, value]) => (value === undefined ? [] : [attribute(key, value)]))
}

/** Children on their own lines; JSX drops whitespace-only lines between elements. */
function indented(children: JSXNode[], depth: number): JSXNode[] {
  const inner = `\n${'  '.repeat(depth + 1)}`
  return [
    ...children.flatMap((child) => [whitespace(inner), child]),
    whitespace(`\n${'  '.repeat(depth)}`)
  ]
}

function childNodes(node: DesignElement, depth: number): JSXNode[] {
  const children = node.children.map((child) => jsxNode(child, depth + 1))
  if (children.length === 0) return []
  // A lone text child stays on the element's line.
  if (children.length === 1 && node.children[0]?.type === 'text') return children
  return indented(children, depth)
}

function element(node: DesignElement, depth: number): JSXNode {
  const name = identifier(tagName(node))
  const children = childNodes(node, depth)
  return {
    type: 'JSXElement',
    openingElement: {
      type: 'JSXOpeningElement',
      name,
      attributes: attributes(node),
      selfClosing: children.length === 0
    },
    closingElement: children.length > 0 ? { type: 'JSXClosingElement', name } : null,
    children
  }
}

function jsxNode(node: DesignNode, depth: number): JSXNode {
  return node.type === 'text' ? text(node.text) : element(node, depth)
}

/** Print a design document as Tailwind JSX, one top-level element per block. */
export function designDocumentToTailwindJSX(document: DesignDocument): string {
  return document.children
    .map((node) => print(jsxNode(node, 0), tsx({ quotes: 'double' }), { indent: '  ' }).code)
    .join('\n\n')
}

/** Tailwind JSX for scene nodes, separated by blank lines. */
export function sceneNodesToTailwindJSX(graph: SceneGraph, nodeIds: string[]): string {
  return nodeIds
    .map((id) => designDocumentToTailwindJSX(sceneNodeToDesignDocument(graph, id, false)))
    .filter(Boolean)
    .join('\n\n')
}
