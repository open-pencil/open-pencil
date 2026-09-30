import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import {
  Annotation,
  StateEffect,
  StateField,
  type ChangeSpec,
  type EditorState,
  type TransactionSpec
} from '@codemirror/state'

import type { DesignJSXElement } from '@open-pencil/design-jsx'

import {
  layerLinkConfig,
  linkedElements,
  linkInsertedElements,
  setLayerBases,
  setLayerLinks,
  type LinkedElement
} from './links'

type SyntaxNode = ReturnType<typeof syntaxTree>['topNode']

/** Marks changes written from the canvas, so they are not rendered back onto it. */
export const fromLayers = Annotation.define<boolean>()

/** An attribute written as an expression whose layer changed on the canvas since. */
export interface StaleAttribute {
  from: number
  to: number
  /** The attribute as the canvas has it now, e.g. `w={100}`. */
  value: string
}

const markStaleAttributes = StateEffect.define<readonly StaleAttribute[]>()

/**
 * Expression attributes the canvas could not patch, until the person edits them or the code is
 * linked again. They stay as written; this only says the canvas now differs.
 */
export const staleAttributes = StateField.define<readonly StaleAttribute[]>({
  create: () => [],
  update(value, transaction) {
    if (transaction.effects.some((effect) => effect.is(setLayerLinks))) return []
    let next = value
    if (transaction.docChanged) {
      const { changes } = transaction
      next = next.flatMap((range) =>
        changes.touchesRange(range.from, range.to)
          ? []
          : [{ ...range, from: changes.mapPos(range.from, 1), to: changes.mapPos(range.to, -1) }]
      )
    }
    for (const effect of transaction.effects) {
      if (!effect.is(markStaleAttributes)) continue
      const marked = new Set(effect.value.map((range) => range.from))
      next = [...next.filter((range) => !marked.has(range.from)), ...effect.value]
    }
    return next
  }
})

/** Snippets of new layers: exported Design JSX and the layer of each element, in order. */
export type LayerSnippet = (nodeId: string) => { code: string; layerIds: string[] } | null

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

function isLiteralAttribute(attribute: SyntaxNode): boolean {
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

function openingTagOf(element: SyntaxNode): SyntaxNode | null {
  return element.getChild('JSXOpenTag') ?? element.getChild('JSXSelfClosingTag')
}

function attributeName(state: EditorState, attribute: SyntaxNode): string {
  const name = attribute.firstChild
  return name ? state.doc.sliceString(name.from, name.to) : ''
}

/** The syntax node of a linked element, if the code there is still that element. */
function elementNode(state: EditorState, element: LinkedElement): SyntaxNode | null {
  const tree = ensureSyntaxTree(state, state.doc.length, 250) ?? syntaxTree(state)
  let node: SyntaxNode | null = tree.resolveInner(element.nameFrom, 1)
  while (node && node.name !== 'JSXElement') node = node.parent
  return node && node.from === element.from && node.to === element.to ? node : null
}

function indentAt(state: EditorState, pos: number): string {
  return /^\s*/.exec(state.doc.lineAt(pos).text)?.[0] ?? ''
}

function reindent(code: string, indent: string): string {
  return code
    .split('\n')
    .map((line, index) => (index === 0 || !line ? line : indent + line))
    .join('\n')
}

/** Removes a range and, when it is alone on its line, the line with it. */
function removal(state: EditorState, from: number, to: number): ChangeSpec {
  const first = state.doc.lineAt(from)
  const last = state.doc.lineAt(to)
  const aloneOnLine =
    !first.text.slice(0, from - first.from).trim() && !last.text.slice(to - last.from).trim()
  if (!aloneOnLine) return { from, to }
  if (first.number > 1) return { from: first.from - 1, to: last.to }
  return { from: first.from, to: Math.min(last.to + 1, state.doc.length) }
}

interface PatchContext {
  state: EditorState
  changes: ChangeSpec[]
  stale: StaleAttribute[]
  insertions: Array<{ at: number; text: string; offset: number; layerIds: string[] }>
  removed: Array<{ from: number; to: number }>
  snippet: LayerSnippet
}

function patchAttributes(
  ctx: PatchContext,
  tag: SyntaxNode,
  base: DesignJSXElement,
  next: DesignJSXElement
) {
  const { state } = ctx
  const written = new Map(
    tag.getChildren('JSXAttribute').map((attribute) => [attributeName(state, attribute), attribute])
  )
  const names = new Set([...Object.keys(base.attributes), ...Object.keys(next.attributes)])
  const additions: string[] = []
  for (const name of names) {
    const value = next.attributes[name]
    if (base.attributes[name] === value) continue
    const attribute = written.get(name)
    if (!attribute) {
      if (value) additions.push(value)
      continue
    }
    if (!isLiteralAttribute(attribute)) {
      if (value) ctx.stale.push({ from: attribute.from, to: attribute.to, value })
      continue
    }
    if (value) {
      ctx.changes.push({ from: attribute.from, to: attribute.to, insert: value })
      continue
    }
    const before = state.doc.sliceString(0, attribute.from)
    ctx.changes.push({
      from: attribute.from - (before.length - before.trimEnd().length),
      to: attribute.to
    })
  }
  if (additions.length === 0) return
  const attributes = tag.getChildren('JSXAttribute')
  const anchor = attributes.at(-1) ?? tag.getChild('JSXIdentifier')
  if (anchor) ctx.changes.push({ from: anchor.to, insert: ` ${additions.join(' ')}` })
}

function patchText(ctx: PatchContext, node: SyntaxNode, text: string | null) {
  const open = node.getChild('JSXOpenTag')
  const close = node.getChild('JSXCloseTag')
  if (!open || !close) return
  // Text with expressions or elements in it is the author's; only plain text is replaced.
  for (let child = open.nextSibling; child && child.from < close.from; child = child.nextSibling) {
    if (child.name !== 'JSXText') return
  }
  const content = ctx.state.doc.sliceString(open.to, close.from)
  const leading = content.length - content.trimStart().length
  const trailing = content.length - content.trimEnd().length
  ctx.changes.push({
    from: open.to + leading,
    to: Math.max(open.to + leading, close.from - trailing),
    insert: text ?? ''
  })
}

function linkedChildren(
  elements: readonly LinkedElement[],
  element: LinkedElement
): Map<string, LinkedElement> {
  const children = new Map<string, LinkedElement>()
  for (const candidate of elements) {
    if (candidate === element || candidate.from < element.from || candidate.to > element.to)
      continue
    const nodeId = candidate.nodeIds[0]
    if (!children.has(nodeId)) children.set(nodeId, candidate)
  }
  return children
}

function insertChild(
  ctx: PatchContext,
  node: SyntaxNode,
  element: LinkedElement,
  written: Map<string, LinkedElement>,
  order: readonly string[],
  nodeId: string
) {
  const snippet = ctx.snippet(nodeId)
  if (!snippet) return
  const { state } = ctx
  const index = order.indexOf(nodeId)
  const previous = order
    .slice(0, index)
    .toReversed()
    .map((id) => written.get(id))
    .find(Boolean)
  const following = order
    .slice(index + 1)
    .map((id) => written.get(id))
    .find(Boolean)
  const parentIndent = indentAt(state, element.from)
  const sibling = previous ?? following
  const indent = sibling ? indentAt(state, sibling.from) : `${parentIndent}  `
  const code = reindent(snippet.code, indent)
  if (previous) {
    const text = `\n${indent}${code}`
    ctx.insertions.push({
      at: previous.to,
      text,
      offset: 1 + indent.length,
      layerIds: snippet.layerIds
    })
    return
  }
  if (following) {
    const at = state.doc.lineAt(following.from).from
    ctx.insertions.push({
      at,
      text: `${indent}${code}\n`,
      offset: indent.length,
      layerIds: snippet.layerIds
    })
    return
  }
  const open = node.getChild('JSXOpenTag')
  if (open) {
    ctx.insertions.push({
      at: open.to,
      text: `\n${indent}${code}`,
      offset: 1 + indent.length,
      layerIds: snippet.layerIds
    })
    return
  }
  // A self-closing parent opens up to hold its first child.
  const selfClosing = node.getChild('JSXSelfClosingTag')
  const end = selfClosing?.lastChild
  if (!selfClosing || !end) return
  const before = state.doc.sliceString(selfClosing.from, end.from)
  const from = selfClosing.from + before.trimEnd().length
  const tag = state.doc.sliceString(element.nameFrom, element.nameTo)
  const text = `>\n${indent}${code}\n${parentIndent}</${tag}>`
  ctx.changes.push({ from, to: end.to })
  ctx.insertions.push({ at: end.to, text, offset: 2 + indent.length, layerIds: snippet.layerIds })
}

function patchChildren(
  ctx: PatchContext,
  node: SyntaxNode,
  element: LinkedElement,
  elements: readonly LinkedElement[],
  base: DesignJSXElement,
  next: DesignJSXElement
) {
  const written = linkedChildren(elements, element)
  const kept = new Set(next.childIds)
  for (const id of base.childIds) {
    const child = written.get(id)
    if (kept.has(id) || !child) continue
    const change = removal(ctx.state, child.from, child.to)
    ctx.changes.push(change)
    ctx.removed.push({ from: child.from, to: child.to })
  }
  const previous = new Set(base.childIds)
  for (const id of next.childIds) {
    if (!previous.has(id)) insertChild(ctx, node, element, written, next.childIds, id)
  }
}

function sameElement(a: DesignJSXElement, b: DesignJSXElement): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Patches the code where linked layers changed since it was last in sync with them: attribute
 * values, text, and added or removed child layers. Values written as expressions stay as
 * written. Returns `null` when nothing changed.
 */
export function layerPatch(state: EditorState, snippet: LayerSnippet): TransactionSpec | null {
  const describe = state.facet(layerLinkConfig)?.describe
  if (!describe) return null
  const elements = state.field(linkedElements)
  const ctx: PatchContext = { state, changes: [], stale: [], insertions: [], removed: [], snippet }
  const bases = new Map<string, DesignJSXElement | null>()
  for (const element of elements) {
    const nodeId = element.nodeIds[0]
    const next = describe(nodeId)
    const base = element.base
    if (!next || !base || sameElement(base, next)) {
      if (next && !base) bases.set(nodeId, next)
      continue
    }
    bases.set(nodeId, next)
    if (ctx.removed.some((range) => element.from >= range.from && element.to <= range.to)) continue
    const node = elementNode(state, element)
    const tag = node && openingTagOf(node)
    if (!node || !tag || next.tag !== base.tag) continue
    patchAttributes(ctx, tag, base, next)
    if (base.text !== next.text) patchText(ctx, node, next.text)
    patchChildren(ctx, node, element, elements, base, next)
  }
  if (bases.size === 0) return null
  const specs: ChangeSpec[] = [
    ...ctx.changes,
    ...ctx.insertions.map(({ at, text }) => ({ from: at, insert: text }))
  ]
  const changes = state.changes(specs)
  const effects: StateEffect<unknown>[] = [setLayerBases.of(bases)]
  if (ctx.stale.length > 0) {
    effects.push(
      markStaleAttributes.of(
        ctx.stale.map((range) => ({
          ...range,
          from: changes.mapPos(range.from, 1),
          to: changes.mapPos(range.to, -1)
        }))
      )
    )
  }
  for (const { at, text, offset, layerIds } of ctx.insertions) {
    const from = changes.mapPos(at, -1) + offset
    effects.push(linkInsertedElements.of({ from, to: from + text.length - offset, layerIds }))
  }
  return { changes, effects }
}
