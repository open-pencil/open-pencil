import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5'

import type { CharacterStyleOverride, StyleRun } from '@open-pencil/scene-graph'
import { tryParseColor } from '@open-pencil/scene-graph/color'
import { parseCSSFontFamily } from '@open-pencil/scene-graph/css'
import type { Color } from '@open-pencil/scene-graph/primitives'

/** How a stretch of a label looks: the cell's style, as tags inside the label change it. */
export interface LabelFormat {
  bold: boolean
  italic: boolean
  underline: boolean
  size: number
  color: Color
  family: string
}

/** A label's text, with runs where its tags make it look other than the cell's style. */
export interface Label {
  text: string
  runs: StyleRun[]
}

type Node = DefaultTreeAdapterTypes.ChildNode
type Element = DefaultTreeAdapterTypes.Element

/** Tags that start their text on a line of its own. */
const BLOCK_TAGS = new Set(['div', 'p', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

function attribute(element: Element, name: string): string | null {
  return element.attrs.find((attr) => attr.name === name)?.value ?? null
}

/** The CSS declarations of an inline `style`, by property. */
function declarations(css: string): Map<string, string> {
  const result = new Map<string, string>()
  for (const part of css.split(';')) {
    const colon = part.indexOf(':')
    if (colon > 0)
      result.set(part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim())
  }
  return result
}

/** A stretch's format as an HTML tag changes it: `<b>`, `<i>`, `<u>`, and `<font>`. */
function tagFormat(element: Element, format: LabelFormat): LabelFormat {
  const next = { ...format }
  const tag = element.tagName
  if (tag === 'b' || tag === 'strong') next.bold = true
  if (tag === 'i' || tag === 'em') next.italic = true
  if (tag === 'u') next.underline = true
  if (tag === 'font') {
    next.color = tryParseColor(attribute(element, 'color') ?? '') ?? next.color
    next.family = parseCSSFontFamily(attribute(element, 'face') ?? undefined) ?? next.family
  }
  return next
}

/** A stretch's format as an element's inline CSS changes it. */
function cssFormat(css: Map<string, string>, format: LabelFormat): LabelFormat {
  const next = { ...format }
  const size = css.get('font-size') ?? ''
  if (size.endsWith('px') && Number.isFinite(Number.parseFloat(size))) {
    next.size = Number.parseFloat(size)
  }
  next.color = tryParseColor(css.get('color') ?? '') ?? next.color
  const weight = css.get('font-weight')
  if (weight) next.bold = weight === 'bold' || Number.parseInt(weight, 10) >= 600
  const style = css.get('font-style')
  if (style) next.italic = style === 'italic'
  const decoration = css.get('text-decoration') ?? css.get('text-decoration-line')
  if (decoration) next.underline = decoration.includes('underline')
  const family = parseCSSFontFamily(css.get('font-family'))
  if (family) next.family = family
  return next
}

function formatOf(element: Element, format: LabelFormat): LabelFormat {
  return cssFormat(declarations(attribute(element, 'style') ?? ''), tagFormat(element, format))
}

/** What a stretch's format changes from the cell's, as a run's style. */
function override(format: LabelFormat, base: LabelFormat): CharacterStyleOverride | null {
  const style: CharacterStyleOverride = {}
  if (format.bold !== base.bold) style.fontWeight = format.bold ? 700 : 400
  if (format.italic !== base.italic) style.italic = format.italic
  if (format.underline !== base.underline) {
    style.textDecoration = format.underline ? 'UNDERLINE' : 'NONE'
  }
  if (format.size !== base.size) style.fontSize = format.size
  if (format.family !== base.family) style.fontFamily = format.family
  const { r, g, b, a } = format.color
  const c = base.color
  if (r !== c.r || g !== c.g || b !== c.b || a !== c.a) {
    style.fills = [{ type: 'SOLID', color: { ...format.color }, opacity: 1, visible: true }]
  }
  return Object.keys(style).length > 0 ? style : null
}

/**
 * A cell's label as text and style runs. An HTML label, as `html=1` makes it, reads as a browser
 * would show it: its whitespace collapsed, a line for each `<br>` and block, and the bold,
 * italic, underline, size, colour and font its tags give a stretch. A plain label is its text.
 */
export function readLabel(value: string, html: boolean, base: LabelFormat): Label {
  if (!html) return { text: value, runs: [] }
  let text = ''
  const runs: StyleRun[] = []
  const lineBreak = () => {
    if (text !== '' && !text.endsWith('\n')) text += '\n'
  }
  const visit = (node: Node, format: LabelFormat) => {
    if (node.nodeName === '#text' && 'value' in node) {
      let piece = node.value.replace(/[ \t\r\n]+/g, ' ')
      if (text === '' || text.endsWith('\n') || text.endsWith(' ')) piece = piece.replace(/^ /, '')
      if (!piece) return
      const style = override(format, base)
      if (style) runs.push({ start: text.length, length: piece.length, style })
      text += piece
      return
    }
    if (!('tagName' in node)) return
    if (node.tagName === 'br') {
      text += '\n'
      return
    }
    const block = BLOCK_TAGS.has(node.tagName)
    if (block) lineBreak()
    const inner = formatOf(node, format)
    for (const child of node.childNodes) visit(child, inner)
    if (block) lineBreak()
  }
  for (const node of parseFragment(value).childNodes) visit(node, base)
  // A line break the last block adds ends nothing.
  const trimmed = text.replace(/[ \n]+$/, '')
  return {
    text: trimmed,
    runs: runs
      .map((run) => ({ ...run, length: Math.min(run.length, trimmed.length - run.start) }))
      .filter((run) => run.length > 0)
  }
}
