import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'

import type { DesignJSXElement } from '@open-pencil/design-jsx'

import type { PatchContext, Rewrite } from './context'
import type { LinkedElement } from './links'
import { indentAt, reindent, removal, type SyntaxNode } from './syntax'

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
  /** Where the block, comments included, starts in the document. */
  start: number
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
      start: leadFrom,
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
  const rewrite: Rewrite = {
    from,
    to: doc.lineAt(last.child.to).to,
    text: '',
    links: [],
    moves: []
  }
  const parts: string[] = []
  let offset = 0
  for (const id of next.childIds) {
    const block = blocks.get(id)
    const snippet = block ? null : ctx.snippet(id)
    const text = block?.text ?? (snippet && `${indent}${reindent(snippet.code, indent)}`)
    if (!text) continue
    if (block) rewrite.moves.push({ from: block.start, to: block.start + text.length, offset })
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

export function patchChildren(
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
    // A reorder rewrites the children with their additions and removals included.
    if (reorderChildren(ctx, node, elements, written, base, next)) return
    // Children that cannot move keep their order, which is marked; layers added or deleted
    // in the same change still reach the code.
    ctx.stale.push({ kind: 'order', from: element.nameFrom, to: element.nameTo })
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
