import type { EditorState } from '@codemirror/state'

import {
  DESIGN_JSX_PROPERTY_ALIASES,
  DESIGN_JSX_STYLE_KEYS,
  designJSXPropertyNames,
  type DesignJSXElement
} from '@open-pencil/design-jsx'

import type { PatchContext } from './context'
import { attributeName, isLiteralAttribute, type SyntaxNode } from './syntax'

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

/** The value an exported attribute holds: `w={400}` → 400, `bg="#FFF"` → `#FFF`. */
function attributeValue(attribute: string): number | string | null {
  const raw = attribute.slice(attribute.indexOf('=') + 1)
  if (raw.startsWith('"')) return raw.slice(1, -1)
  if (!raw.startsWith('{')) return null
  try {
    const value: unknown = JSON.parse(raw.slice(1, -1))
    return typeof value === 'number' || typeof value === 'string' ? value : null
  } catch {
    return null
  }
}

/** The `style={{ … }}` entry the renderer reads for a property, if written as a literal object. */
function styleEntry(
  state: EditorState,
  tag: SyntaxNode,
  name: string
): { property: SyntaxNode; px: boolean } | null {
  const keys = Object.hasOwn(DESIGN_JSX_STYLE_KEYS, name) ? DESIGN_JSX_STYLE_KEYS[name] : null
  const style = tag
    .getChildren('JSXAttribute')
    .find((attribute) => attributeName(state, attribute) === 'style')
  const object = style?.getChild('JSXEscape')?.getChild('ObjectExpression')
  if (!keys || !object) return null
  const properties = object.getChildren('Property').map((property) => {
    const key = property.firstChild
    const text = key ? state.doc.sliceString(key.from, key.to) : ''
    return { property, key: text.replace(/^["']|["']$/g, '') }
  })
  for (const { key, px } of keys) {
    const found = properties.find((candidate) => candidate.key === key)
    if (found) return { property: found.property, px: px ?? false }
  }
  return null
}

/** A value for a style entry in the format already written there: `400`, or `'400px'`. */
function styleValue(written: string, kind: string, value: number | string, px: boolean) {
  if (kind === 'Number') return typeof value === 'number' ? String(value) : null
  const quote = written[0]
  const text =
    typeof value === 'number' && px && written.slice(1, -1).endsWith('px')
      ? `${value}px`
      : String(value)
  return `${quote}${text.replaceAll(quote, `\\${quote}`)}${quote}`
}

/**
 * Patches a property the person wrote inside `style={{ … }}` instead of as an attribute. Values
 * the renderer cannot read as written, such as `'50%'`, are marked rather than rewritten.
 * Returns whether the property was found there.
 */
function patchStyle(
  ctx: PatchContext,
  tag: SyntaxNode,
  name: string,
  attribute: string | undefined
): boolean {
  const entry = styleEntry(ctx.state, tag, name)
  if (!entry) return false
  const { property, px } = entry
  const valueNode = property.lastChild
  const value = attribute ? attributeValue(attribute) : null
  const written = valueNode ? ctx.state.doc.sliceString(valueNode.from, valueNode.to) : ''
  const pxReadable = !px || valueNode?.name !== 'String' || written.slice(1, -1).endsWith('px')
  const next =
    valueNode &&
    value !== null &&
    pxReadable &&
    (valueNode.name === 'Number' || valueNode.name === 'String')
      ? styleValue(written, valueNode.name, value, px)
      : null
  if (valueNode && next !== null) {
    ctx.changes.push({ from: valueNode.from, to: valueNode.to, insert: next })
  } else if (attribute) {
    ctx.stale.push({ kind: 'value', from: property.from, to: property.to, value: attribute })
  }
  return true
}

export function patchAttributes(
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
      if (patchStyle(ctx, tag, name, value)) continue
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

export function patchText(ctx: PatchContext, node: SyntaxNode, text: string | null) {
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
