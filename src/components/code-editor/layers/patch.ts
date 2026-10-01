import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import {
  Annotation,
  StateEffect,
  StateField,
  type ChangeSpec,
  type EditorState,
  type TransactionSpec
} from '@codemirror/state'

import {
  DESIGN_JSX_PROPERTY_ALIASES,
  designJSXPropertyNames,
  type DesignJSXElement
} from '@open-pencil/design-jsx'

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

/**
 * Code the canvas could not patch since its layer changed: an attribute written as an
 * expression (`value`), or children that could not be moved into the new layer order.
 */
export type StaleAttribute =
  | { kind: 'value'; from: number; to: number; /** e.g. `w={100}` */ value: string }
  | { kind: 'order'; from: number; to: number }

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

/** Text replacing a range, with the elements in it to link, by offset into the text. */
interface Rewrite {
  from: number
  to: number
  text: string
  links: Array<{ offset: number; length: number; layerIds: Array<string | null> }>
}

interface PatchContext {
  state: EditorState
  changes: ChangeSpec[]
  stale: StaleAttribute[]
  rewrites: Rewrite[]
  insertions: Array<{ at: number; text: string; offset: number; layerIds: string[] }>
  removed: Array<{ from: number; to: number }>
  snippet: LayerSnippet
}

/** Alias → the name Design JSX writes, e.g. `width` → `w`. */
const CANONICAL_NAMES = new Map(
  Object.entries(DESIGN_JSX_PROPERTY_ALIASES).flatMap(([name, aliases]) =>
    aliases.map((alias) => [alias, name] as const)
  )
)

/**
 * The attributes of a tag by the name Design JSX writes, so `width={320}` answers for `w`. When
 * several names of one property are written, the one the renderer reads wins.
 */
function writtenAttributes(
  state: EditorState,
  tag: SyntaxNode
): Map<string, { attribute: SyntaxNode; name: string }> {
  const written = new Map<string, { attribute: SyntaxNode; name: string; rank: number }>()
  for (const attribute of tag.getChildren('JSXAttribute')) {
    const name = attributeName(state, attribute)
    const canonical = CANONICAL_NAMES.get(name) ?? name
    const rank = designJSXPropertyNames(canonical).indexOf(name)
    const current = written.get(canonical)
    if (!current || rank < current.rank) written.set(canonical, { attribute, name, rank })
  }
  return written
}

function patchAttributes(
  ctx: PatchContext,
  tag: SyntaxNode,
  base: DesignJSXElement,
  next: DesignJSXElement
) {
  const { state } = ctx
  const written = writtenAttributes(state, tag)
  const names = new Set([...Object.keys(base.attributes), ...Object.keys(next.attributes)])
  const additions: string[] = []
  for (const name of names) {
    const value = next.attributes[name]
    if (base.attributes[name] === value) continue
    const { attribute, name: writtenName } = written.get(name) ?? {}
    if (!attribute || !writtenName) {
      if (value) additions.push(value)
      continue
    }
    if (!isLiteralAttribute(attribute)) {
      if (value) ctx.stale.push({ kind: 'value', from: attribute.from, to: attribute.to, value })
      continue
    }
    if (value) {
      // The value changes; the name stays the one the person wrote, such as `width`.
      const insert = writtenName + value.slice(name.length)
      ctx.changes.push({ from: attribute.from, to: attribute.to, insert })
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

/** A blank line or a JSX comment, which travels with the element below it. */
const TRIVIA_LINE = /^\s*(\{\s*\/\*.*\*\/\s*\})?\s*$/

/** Layer ids of the elements in a range, in pre-order, `null` for unlinked ones. */
function layerIdsWithin(
  state: EditorState,
  elements: readonly LinkedElement[],
  from: number,
  to: number
): Array<string | null> {
  const ids: Array<string | null> = []
  const tree = ensureSyntaxTree(state, state.doc.length, 250) ?? syntaxTree(state)
  tree.iterate({
    from,
    to,
    enter(node) {
      if (node.name !== 'JSXElement' || node.from < from || node.to > to) return
      const linked = elements.find((e) => e.from === node.from && e.to === node.to)
      ids.push(linked?.nodeIds[0] ?? null)
    }
  })
  return ids
}

/** A child element with the blank lines and comments above it, kept exactly as written. */
interface Block {
  text: string
  /** Where the element starts in the block's text, and its length. */
  offset: number
  length: number
  /** Where the element starts in the document. */
  from: number
}

/** Whether only blank lines and JSX comments sit between two child elements. */
function isTrivia(text: string): boolean {
  return (
    !text ||
    text
      .slice(0, -1)
      .split('\n')
      .every((line) => TRIVIA_LINE.test(line))
  )
}

/**
 * Splits the children span into blocks, or returns `null` when a child shares its lines with
 * other code or something other than comments sits between children.
 */
function childBlocks(
  state: EditorState,
  start: number,
  children: ReadonlyArray<{ id: string; child: LinkedElement }>
): Map<string, Block> | null {
  const { doc } = state
  const blocks = new Map<string, Block>()
  let leadFrom = start
  for (const { id, child } of children) {
    const first = doc.lineAt(child.from)
    const last = doc.lineAt(child.to)
    const aloneOnLines =
      !doc.sliceString(first.from, child.from).trim() && !doc.sliceString(child.to, last.to).trim()
    if (!aloneOnLines || leadFrom > first.from) return null
    if (!isTrivia(doc.sliceString(leadFrom, first.from))) return null
    blocks.set(id, {
      text: doc.sliceString(leadFrom, last.to),
      offset: child.from - leadFrom,
      length: child.to - child.from,
      from: child.from
    })
    leadFrom = last.to + 1
  }
  return blocks
}

/**
 * Moves child elements into the canvas order: each child, with the blank lines and comments
 * above it, is a block kept exactly as written, and the span of all blocks is written again in
 * the new order, with added layers generated and removed ones left out. Returns `false` when
 * the children cannot be moved safely, such as code between them that is not a layer.
 */
function reorderChildren(
  ctx: PatchContext,
  node: SyntaxNode,
  elements: readonly LinkedElement[],
  written: Map<string, LinkedElement>,
  base: DesignJSXElement,
  next: DesignJSXElement
): boolean {
  const { doc } = ctx.state
  const open = node.getChild('JSXOpenTag')
  const children = base.childIds.flatMap((id) => {
    const child = written.get(id)
    return child ? [{ id, child }] : []
  })
  const last = children.at(-1)
  if (!open || !last || doc.sliceString(open.to, doc.lineAt(open.to).to).trim()) return false
  const from = doc.lineAt(open.to).to + 1
  const blocks = childBlocks(ctx.state, from, children)
  if (!blocks) return false
  const indent = indentAt(ctx.state, children[0].child.from)
  const rewrite: Rewrite = { from, to: doc.lineAt(last.child.to).to, text: '', links: [] }
  const parts: string[] = []
  let offset = 0
  for (const id of next.childIds) {
    const block = blocks.get(id)
    const snippet = block ? null : ctx.snippet(id)
    const text = block?.text ?? (snippet && `${indent}${reindent(snippet.code, indent)}`)
    if (!text) continue
    rewrite.links.push({
      offset: offset + (block?.offset ?? indent.length),
      length: block?.length ?? text.length - indent.length,
      layerIds: block
        ? layerIdsWithin(ctx.state, elements, block.from, block.from + block.length)
        : (snippet?.layerIds ?? [])
    })
    parts.push(text)
    offset += text.length + 1
  }
  rewrite.text = parts.join('\n')
  ctx.rewrites.push(rewrite)
  ctx.removed.push({ from: rewrite.from, to: rewrite.to })
  return true
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
  const survivors = new Set(next.childIds.filter((id) => base.childIds.includes(id)))
  const before = base.childIds.filter((id) => survivors.has(id) && written.has(id))
  const after = next.childIds.filter((id) => survivors.has(id) && written.has(id))
  if (before.some((id, index) => id !== after[index])) {
    if (!reorderChildren(ctx, node, elements, written, base, next)) {
      ctx.stale.push({ kind: 'order', from: element.nameFrom, to: element.nameTo })
    }
    return
  }
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
  const ctx: PatchContext = {
    state,
    changes: [],
    stale: [],
    rewrites: [],
    insertions: [],
    removed: [],
    snippet
  }
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
    ...ctx.rewrites.map(({ from, to, text }) => ({ from, to, insert: text })),
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
  for (const rewrite of ctx.rewrites) {
    const start = changes.mapPos(rewrite.from, -1)
    for (const { offset, length, layerIds } of rewrite.links) {
      effects.push(
        linkInsertedElements.of({ from: start + offset, to: start + offset + length, layerIds })
      )
    }
  }
  for (const { at, text, offset, layerIds } of ctx.insertions) {
    const from = changes.mapPos(at, -1) + offset
    effects.push(linkInsertedElements.of({ from, to: from + text.length - offset, layerIds }))
  }
  return { changes, effects }
}
