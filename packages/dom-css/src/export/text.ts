import { isEqual } from 'es-toolkit/predicate'

import type { CharacterStyleOverride, HyperlinkTarget, SceneNode } from '@open-pencil/scene-graph'
import {
  hasTextList,
  listNumberFormat,
  paragraphSpacingAt,
  paragraphStyleAt,
  textListItems,
  textParagraphRanges,
  type TextListItem,
  type TextParagraphRange
} from '@open-pencil/scene-graph/text'

import type { DesignElement, DesignNode, DesignStyleDeclaration } from '../types'
import { fillToCSS, letterSpacingToCSS, lineHeightToCSS } from './css'

/** The character styles CSS writes, as a text layer and its runs hold them. */
type CharacterStyle = Pick<
  SceneNode,
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'italic'
  | 'letterSpacing'
  | 'lineHeight'
  | 'fills'
  | 'textDecoration'
  | 'textDecorationStyle'
  | 'textDecorationThickness'
  | 'textDecorationFills'
  | 'textDecorationSkipInk'
  | 'textUnderlineOffset'
  | 'textCase'
>

type CharacterStyleKey = keyof CharacterStyle

const CHARACTER_STYLE_KEYS: readonly CharacterStyleKey[] = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'italic',
  'letterSpacing',
  'lineHeight',
  'fills',
  'textDecoration',
  'textDecorationStyle',
  'textDecorationThickness',
  'textDecorationFills',
  'textDecorationSkipInk',
  'textUnderlineOffset',
  'textCase'
]

/** A list's indent per level, in ems of its first character, as the canvas lays lists out. */
const LIST_INDENT_EMS = 1.5

const DECORATION_PROPERTIES = new Set([
  'text-decoration-line',
  'text-decoration-style',
  'text-decoration-color',
  'text-decoration-thickness',
  'text-underline-offset',
  'text-decoration-skip-ink'
])

const px = (value: number) => `${value}px`

/** Characters `[start, end)`, the run style over them, and where they link to. */
interface StyledRange {
  start: number
  end: number
  style: CharacterStyle
  href: string | null
}

/** Links a page can follow: to the web, to mail, or to a phone; others are left out. */
const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/** A link as an `href`, for a link to a URL a page can follow. */
function linkHref(link: HyperlinkTarget | null | undefined): string | null {
  if (link?.type !== 'URL') return null
  try {
    return LINK_PROTOCOLS.has(new URL(link.value).protocol) ? link.value : null
  } catch {
    // Not an absolute URL, which a page could not follow from anywhere it is placed.
    return null
  }
}

export function textCaseToCSS(value: SceneNode['textCase']): string | undefined {
  if (value === 'UPPER') return 'uppercase'
  if (value === 'LOWER') return 'lowercase'
  if (value === 'TITLE') return 'capitalize'
  return undefined
}

function characterStyle(node: SceneNode, override: CharacterStyleOverride = {}): CharacterStyle {
  const style = Object.fromEntries(CHARACTER_STYLE_KEYS.map((key) => [key, node[key]]))
  for (const key of CHARACTER_STYLE_KEYS) {
    const value = override[key]
    if (value !== undefined) style[key] = value
  }
  return style as CharacterStyle
}

/** The text in ranges of one style each: the runs, and the layer's own style between them. */
function styledRanges(node: SceneNode): StyledRange[] {
  const ranges: StyledRange[] = []
  const base = characterStyle(node)
  let at = 0
  for (const run of node.styleRuns.toSorted((a, b) => a.start - b.start)) {
    const start = Math.max(at, run.start)
    const end = Math.min(node.text.length, run.start + run.length)
    if (start > at) ranges.push({ start: at, end: start, style: base, href: null })
    if (end > start) {
      const href = linkHref(run.style.hyperlink)
      ranges.push({ start, end, style: characterStyle(node, run.style), href })
    }
    at = Math.max(at, end)
  }
  if (at < node.text.length) {
    ranges.push({ start: at, end: node.text.length, style: base, href: null })
  }
  return ranges
}

/** Underline or strikethrough as CSS writes it: Figma's offset is CSS's, from the baseline. */
function decorationCSS(style: CharacterStyle): DesignStyleDeclaration {
  if (style.textDecoration === 'NONE') return {}
  const underline = style.textDecoration === 'UNDERLINE'
  const css: DesignStyleDeclaration = {
    'text-decoration-line': underline ? 'underline' : 'line-through'
  }
  if (style.textDecorationStyle !== 'SOLID') {
    css['text-decoration-style'] = style.textDecorationStyle.toLowerCase()
  }
  const color = fillToCSS(style.textDecorationFills.find((fill) => fill.visible))
  if (color) css['text-decoration-color'] = color
  if (style.textDecorationThickness !== null) {
    css['text-decoration-thickness'] = px(style.textDecorationThickness)
  }
  if (underline && style.textUnderlineOffset !== null) {
    css['text-underline-offset'] = px(style.textUnderlineOffset)
  }
  if (underline && !style.textDecorationSkipInk) css['text-decoration-skip-ink'] = 'none'
  return css
}

function characterCSS(style: CharacterStyle, decorated: boolean): DesignStyleDeclaration {
  return {
    color: fillToCSS(style.fills.at(0)) ?? '',
    'font-family': style.fontFamily,
    'font-size': px(style.fontSize),
    'font-weight': String(style.fontWeight),
    'font-style': style.italic ? 'italic' : 'normal',
    'letter-spacing': letterSpacingToCSS(style.letterSpacing),
    'line-height': style.lineHeight === null ? 'normal' : lineHeightToCSS(style.lineHeight),
    'text-transform': textCaseToCSS(style.textCase) ?? 'none',
    ...(decorated ? decorationCSS(style) : {})
  }
}

/** What `css` sets differently from `base`. */
function differing(
  css: DesignStyleDeclaration,
  base: DesignStyleDeclaration
): DesignStyleDeclaration {
  return Object.fromEntries(
    Object.entries(css).filter(([property, value]) => value !== '' && base[property] !== value)
  )
}

/**
 * Whether the text decorates every character alike. CSS draws an element's decoration through
 * its descendants, which cannot take it off, so mixed decorations go on the spans instead.
 */
function uniformDecoration(node: SceneNode, ranges: readonly StyledRange[]): boolean {
  const decorations = ranges
    .filter((range) => node.text.slice(range.start, range.end).replaceAll('\n', '') !== '')
    .map((range) => decorationCSS(range.style))
  return decorations.every((decoration) => isEqual(decoration, decorations[0]))
}

interface TextProjection {
  node: SceneNode
  ranges: StyledRange[]
  base: DesignStyleDeclaration
  decorated: boolean
}

function textNode(text: string): DesignNode {
  return { type: 'text', text }
}

function element(
  tagName: string,
  inlineStyle: DesignStyleDeclaration,
  children: DesignNode[]
): DesignElement {
  return { type: 'element', tagName, attrs: {}, inlineStyle, children }
}

/**
 * A link styled as the text around it: a link draws in the text's colour and with only the
 * decoration its characters have, as in Figma, not in a browser's link style.
 */
function linkElement(href: string, css: DesignStyleDeclaration, text: string): DesignElement {
  const style = { color: 'inherit', 'text-decoration-line': 'none', ...css }
  return { ...element('a', style, [textNode(text)]), attrs: { href } }
}

/**
 * `text[start, end)` as text and spans, each span setting only what differs from the layer;
 * linked characters are a link instead.
 */
function inlineContent(projection: TextProjection, start: number, end: number): DesignNode[] {
  const { node, ranges, base, decorated } = projection
  const pieces: { css: DesignStyleDeclaration; text: string; href: string | null }[] = []
  for (const range of ranges) {
    const from = Math.max(start, range.start)
    const to = Math.min(end, range.end)
    if (to <= from) continue
    const css = differing(characterCSS(range.style, !decorated), base)
    const text = node.text.slice(from, to)
    const previous = pieces.at(-1)
    if (previous && previous.href === range.href && isEqual(previous.css, css)) {
      previous.text += text
    } else pieces.push({ css, text, href: range.href })
  }
  return pieces.map(({ css, text, href }) => {
    if (href) return linkElement(href, css, text)
    return Object.keys(css).length === 0 ? textNode(text) : element('span', css, [textNode(text)])
  })
}

/** A paragraph's content; an empty one holds a line break, which gives it a line's height. */
function paragraphContent(projection: TextProjection, range: TextParagraphRange): DesignNode[] {
  if (range.end === range.start) return [element('br', {}, [])]
  return inlineContent(projection, range.start, range.end)
}

/** Text that CSS lays out in one element: no lists, and no spacing or indent between lines. */
function needsBlocks(node: SceneNode): boolean {
  if (hasTextList(node)) return true
  const paragraphs = textParagraphRanges(node.text)
  return paragraphs.some(
    (_, index) =>
      paragraphSpacingAt(node, index, 'paragraphIndent') > 0 ||
      (index < paragraphs.length - 1 && paragraphSpacingAt(node, index, 'paragraphSpacing') > 0)
  )
}

/** The space after paragraph `index`: list spacing between two items, paragraph spacing else. */
function spaceAfter(node: SceneNode, index: number, count: number): number {
  if (index >= count - 1) return 0
  const betweenItems =
    paragraphStyleAt(node.textParagraphs, index).listType !== 'NONE' &&
    paragraphStyleAt(node.textParagraphs, index + 1).listType !== 'NONE'
  return paragraphSpacingAt(node, index, betweenItems ? 'listSpacing' : 'paragraphSpacing')
}

function listStyleType(item: TextListItem): string {
  if (item.listType === 'UNORDERED') return 'disc'
  const format = listNumberFormat(item.level)
  if (format === 'LOWER_ALPHA') return 'lower-alpha'
  if (format === 'LOWER_ROMAN') return 'lower-roman'
  return 'decimal'
}

/** A list in the text, open at one level, with the item that nested lists go into. */
interface OpenList {
  level: number
  listType: TextListItem['listType']
  element: DesignElement
  item: DesignElement | undefined
}

/** Where the next list item goes: closes lists deeper than it, or of another kind at its level. */
function closeListsFor(open: OpenList[], item: TextListItem): void {
  while ((open.at(-1)?.level ?? 0) > item.level) open.pop()
  const top = open.at(-1)
  if (top?.level === item.level && (top.listType !== item.listType || item.startsList)) open.pop()
}

/**
 * Opens a list one level below the innermost open one, inside its last item; a level an item
 * skips gets an item without a marker to hold it.
 */
function openList(
  open: OpenList[],
  blocks: DesignNode[],
  item: TextListItem,
  indent: number
): void {
  const parent = open.at(-1)
  const level = (parent?.level ?? 0) + 1
  const list = element(
    item.listType === 'ORDERED' ? 'ol' : 'ul',
    {
      ...blockMargins(0, 0),
      'padding-inline-start': px(indent),
      'list-style-type': level === item.level ? listStyleType(item) : 'none'
    },
    []
  )
  if (parent) {
    parent.item ??= appendTo(parent.element, element('li', { 'list-style-type': 'none' }, []))
    // The space after the item the list nests in stands above the list.
    const spacing = parent.item.inlineStyle?.['margin-bottom']
    if (spacing && parent.item.inlineStyle && list.inlineStyle) {
      delete parent.item.inlineStyle['margin-bottom']
      list.inlineStyle['margin-top'] = spacing
    }
    parent.item.children.push(list)
  } else blocks.push(list)
  open.push({ level, listType: item.listType, element: list, item: undefined })
}

function plainParagraph(
  projection: TextProjection,
  index: number,
  range: TextParagraphRange,
  after: number
): DesignElement {
  const style = blockMargins(0, after)
  const indent = paragraphSpacingAt(projection.node, index, 'paragraphIndent')
  if (indent > 0) style['text-indent'] = px(indent)
  return element('p', style, paragraphContent(projection, range))
}

/**
 * The text as blocks, as Figma lays it out: a paragraph per plain one, lists nested by level
 * with Figma's markers (bullets at every level, numbers counting 1, a, i as they nest), and the
 * space after each paragraph as a margin on what ends it.
 */
function blockContent(projection: TextProjection): DesignNode[] {
  const { node } = projection
  const paragraphs = textParagraphRanges(node.text)
  const items = new Map(
    textListItems(node.text, node.textParagraphs).map((item) => [item.paragraph, item])
  )
  const blocks: DesignNode[] = []
  const open: OpenList[] = []
  for (const [index, range] of paragraphs.entries()) {
    const after = spaceAfter(node, index, paragraphs.length)
    const item = items.get(index)
    if (!item) {
      open.length = 0
      blocks.push(plainParagraph(projection, index, range, after))
      continue
    }
    const unit = groupEm(projection, paragraphs, item) * LIST_INDENT_EMS
    closeListsFor(open, item)
    while ((open.at(-1)?.level ?? 0) < item.level) {
      // A hanging list's markers stand outside the text, so its first level has no indent.
      const first = open.length === 0
      openList(open, blocks, item, first && node.hangingList ? 0 : unit)
    }
    const list = open.at(-1)
    if (!list) continue
    const style: DesignStyleDeclaration = after > 0 ? { 'margin-bottom': px(after) } : {}
    list.item = appendTo(list.element, element('li', style, paragraphContent(projection, range)))
  }
  return blocks
}

/** Margins above and below a block, written out: paragraphs and lists have their own in CSS. */
function blockMargins(top: number, bottom: number): DesignStyleDeclaration {
  return { 'margin-top': px(top), 'margin-bottom': px(bottom) }
}

function appendTo(parent: DesignElement, child: DesignElement): DesignElement {
  parent.children.push(child)
  return child
}

/** The size of a list's first character, which its indents are measured in. */
function groupEm(
  projection: TextProjection,
  paragraphs: readonly TextParagraphRange[],
  item: TextListItem
): number {
  const at = paragraphs[item.groupStart]?.start ?? item.start
  const range = projection.ranges.find((candidate) => at >= candidate.start && at < candidate.end)
  return range?.style.fontSize ?? projection.node.fontSize
}

/**
 * A text layer's element: its tag, its style with the decoration the whole text shares, and
 * its content. Runs of characters styled apart become spans; text with lists, paragraph
 * spacing, or a first-line indent becomes blocks, which a `<div>` holds.
 */
export function textElementContent(
  node: SceneNode,
  layerStyle: DesignStyleDeclaration
): { tagName: string; style: DesignStyleDeclaration; children: DesignNode[] } {
  const ranges = styledRanges(node)
  const decorated = uniformDecoration(node, ranges)
  const style = Object.fromEntries(
    Object.entries(layerStyle).filter(([property]) => !DECORATION_PROPERTIES.has(property))
  )
  if (decorated) Object.assign(style, decorationCSS(characterStyle(node)))
  const projection: TextProjection = {
    node,
    ranges,
    base: characterCSS(characterStyle(node), decorated),
    decorated
  }
  if (!needsBlocks(node)) {
    return { tagName: 'span', style, children: inlineContent(projection, 0, node.text.length) }
  }
  return { tagName: 'div', style, children: blockContent(projection) }
}
