import { countBy } from 'es-toolkit/array'
import { isEqual } from 'es-toolkit/predicate'

import type {
  CharacterStyleOverride,
  HyperlinkTarget,
  SceneNode,
  StyleRun,
  TextParagraphStyle
} from '@open-pencil/scene-graph'
import {
  parseCSSColor,
  parseCSSFontFamily,
  parseCSSLetterSpacing,
  parseCSSLineHeight,
  parseCSSNumber
} from '@open-pencil/scene-graph/css'

import type { DesignElement, DesignNode, DesignStyleDeclaration } from '../types'
import { colorToFillFromCSS, mergedStyle, pickStyle } from './css-values'

/** The character styles a text layer and its runs take from CSS. */
export type CSSCharacterStyle = Pick<
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

/** A character's style and the link it is part of. */
type CharacterOfText = CSSCharacterStyle & { hyperlink?: HyperlinkTarget }

/**
 * What characters take from the elements around them: the properties CSS inherits, and the
 * decoration, which CSS draws through descendants.
 */
const CHARACTER_PROPERTIES = [
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'letter-spacing',
  'line-height',
  'white-space',
  'text-transform',
  'text-decoration-line',
  'text-decoration-style',
  'text-decoration-color',
  'text-decoration-thickness',
  'text-underline-offset',
  'text-decoration-skip-ink'
]

const TEXT_BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

/** What browsers' default stylesheet gives inline formatting elements that CSS does not set. */
const FORMATTING_DEFAULTS: Record<string, DesignStyleDeclaration> = {
  b: { 'font-weight': '700' },
  strong: { 'font-weight': '700' },
  i: { 'font-style': 'italic' },
  em: { 'font-style': 'italic' },
  u: { 'text-decoration-line': 'underline' },
  ins: { 'text-decoration-line': 'underline' },
  s: { 'text-decoration-line': 'line-through' },
  del: { 'text-decoration-line': 'line-through' }
}
const LIST_TAGS = new Set(['ul', 'ol'])

/** Lengths CSS gives as a number of pixels, or `null` for keywords such as `auto`. */
function pixels(value: string | undefined): number | null {
  const trimmed = value?.trim()
  if (!trimmed || !/^-?[\d.]+(px)?$/.test(trimmed)) return null
  return parseCSSNumber(trimmed)
}

function decorationLine(value: string | undefined): SceneNode['textDecoration'] {
  if (value?.includes('underline')) return 'UNDERLINE'
  if (value?.includes('line-through')) return 'STRIKETHROUGH'
  return 'NONE'
}

function decorationStyle(value: string | undefined): SceneNode['textDecorationStyle'] {
  const style = value?.trim().toLowerCase()
  if (style === 'dotted') return 'DOTTED'
  if (style === 'wavy') return 'WAVY'
  return 'SOLID'
}

function textCaseFromCSS(value: string | undefined): SceneNode['textCase'] {
  if (value === 'uppercase') return 'UPPER'
  if (value === 'lowercase') return 'LOWER'
  if (value === 'capitalize') return 'TITLE'
  return 'ORIGINAL'
}

/** The character style of CSS declarations, over `base` for what they leave out. */
export function characterStyleFromCSS(
  style: DesignStyleDeclaration,
  base: CSSCharacterStyle
): CSSCharacterStyle {
  const fills = colorToFillFromCSS(pickStyle(style, 'color'))
  const family = parseCSSFontFamily(pickStyle(style, 'font-family'))
  const decorationColor = pickStyle(style, 'text-decoration-color')
  const decorationFills = parseCSSColor(decorationColor) ? colorToFillFromCSS(decorationColor) : []
  const line = pickStyle(style, 'text-decoration-line')
  const fontStyle = pickStyle(style, 'font-style')
  const lineHeight = pickStyle(style, 'line-height')
  // `normal` is automatic, a null; a value CSS writes some other way keeps the base.
  const parsedLineHeight = parseCSSLineHeight(lineHeight)
  const textTransform = pickStyle(style, 'text-transform')
  return {
    fontFamily: family || base.fontFamily,
    fontSize: parseCSSNumber(pickStyle(style, 'font-size')) ?? base.fontSize,
    fontWeight: parseCSSNumber(pickStyle(style, 'font-weight')) ?? base.fontWeight,
    italic: fontStyle === undefined ? base.italic : fontStyle === 'italic',
    letterSpacing: parseCSSLetterSpacing(pickStyle(style, 'letter-spacing')) ?? base.letterSpacing,
    lineHeight: parsedLineHeight === undefined ? base.lineHeight : parsedLineHeight,
    fills: fills.length > 0 ? fills : base.fills,
    textDecoration: line === undefined ? base.textDecoration : decorationLine(line),
    textDecorationStyle:
      pickStyle(style, 'text-decoration-style') === undefined
        ? base.textDecorationStyle
        : decorationStyle(pickStyle(style, 'text-decoration-style')),
    textDecorationFills: decorationColor === undefined ? base.textDecorationFills : decorationFills,
    textDecorationThickness:
      pickStyle(style, 'text-decoration-thickness') === undefined
        ? base.textDecorationThickness
        : pixels(pickStyle(style, 'text-decoration-thickness')),
    textUnderlineOffset:
      pickStyle(style, 'text-underline-offset') === undefined
        ? base.textUnderlineOffset
        : pixels(pickStyle(style, 'text-underline-offset')),
    textDecorationSkipInk:
      pickStyle(style, 'text-decoration-skip-ink') === undefined
        ? base.textDecorationSkipInk
        : pickStyle(style, 'text-decoration-skip-ink') !== 'none',
    textCase: textTransform === undefined ? base.textCase : textCaseFromCSS(textTransform)
  }
}

/** What the characters inside `element` take from it and the elements around it. */
function characterDeclarations(
  element: DesignElement,
  around: DesignStyleDeclaration
): DesignStyleDeclaration {
  const own = { ...FORMATTING_DEFAULTS[element.tagName.toLowerCase()], ...mergedStyle(element) }
  const inherited: DesignStyleDeclaration = {}
  for (const property of CHARACTER_PROPERTIES) {
    const value = pickStyle(own, property) ?? pickStyle(around, property)
    if (value !== undefined) inherited[property] = value
  }
  return inherited
}

/** Whether the element holds only characters: text, inline elements, and line breaks. */
export function isInlineContent(
  element: DesignElement,
  isInlineElement: (element: DesignElement) => boolean
): boolean {
  return element.children.every(
    (child) =>
      child.type === 'text' ||
      child.tagName.toLowerCase() === 'br' ||
      (isInlineElement(child) && isInlineContent(child, isInlineElement))
  )
}

function isWhitespace(node: DesignNode): boolean {
  return node.type === 'text' && node.text.trim() === ''
}

function isList(
  element: DesignElement,
  isListPlain: (element: DesignElement) => boolean,
  isPlain: (element: DesignElement) => boolean
): boolean {
  if (!LIST_TAGS.has(element.tagName.toLowerCase()) || !isListPlain(element)) return false
  return element.children.every(
    (child) =>
      isWhitespace(child) ||
      (child.type === 'element' && child.tagName.toLowerCase() === 'li' && isListItem(child))
  )

  function isListItem(item: DesignElement): boolean {
    return item.children.every(
      (child) =>
        child.type === 'text' ||
        child.tagName.toLowerCase() === 'br' ||
        isList(child, isPlain, isPlain) ||
        (!LIST_TAGS.has(child.tagName.toLowerCase()) && isPlain(child))
    )
  }
}

/**
 * Whether the element holds text in blocks, as Figma keeps it in one layer: it is a list, or
 * holds only paragraphs, headings, and lists of characters with no box of their own.
 */
export function holdsTextBlocks(
  element: DesignElement,
  isPlain: (element: DesignElement) => boolean,
  isInlineElement: (element: DesignElement) => boolean
): boolean {
  if (LIST_TAGS.has(element.tagName.toLowerCase())) return isList(element, () => true, isPlain)
  const blocks = element.children.filter((child) => !isWhitespace(child))
  return (
    blocks.length > 0 &&
    blocks.every(
      (child) =>
        child.type === 'element' &&
        (isList(child, isPlain, isPlain) ||
          (TEXT_BLOCK_TAGS.has(child.tagName.toLowerCase()) &&
            isPlain(child) &&
            isInlineContent(child, isInlineElement)))
    )
  )
}

/** Text with its runs and paragraphs, as one text layer holds it. */
export interface RichText {
  text: string
  styleRuns: StyleRun[]
  textParagraphs: TextParagraphStyle[]
  /** The space after each paragraph, from the margins between blocks. */
  spaceAfter: number[]
  /** Each paragraph's first-line indent. */
  indents: number[]
  /** Whether the outermost list puts its markers outside the text, with no indent of its own. */
  hangingList: boolean
}

interface Collector {
  base: CSSCharacterStyle
  text: string
  styles: CharacterOfText[]
  /** The link the characters added now are part of. */
  link: HyperlinkTarget | null
  paragraphs: TextParagraphStyle[]
  spaceAfter: number[]
  indents: number[]
  /** Space collected from margins since the last paragraph ended. */
  pending: number
  hangingList: boolean | undefined
}

function preservesWhitespace(style: DesignStyleDeclaration): boolean {
  const whiteSpace = pickStyle(style, 'white-space')
  return whiteSpace === 'pre' || whiteSpace === 'pre-wrap' || whiteSpace === 'pre-line'
}

function appendCharacters(collector: Collector, text: string, style: CharacterOfText): void {
  const styled = collector.link ? { ...style, hyperlink: collector.link } : style
  collector.text += text
  collector.styles.push(...Array.from({ length: text.length }, () => styled))
}

/** Where a link element goes, for an `<a>` with an `href`. */
export function elementLink(element: DesignElement): HyperlinkTarget | null {
  if (element.tagName.toLowerCase() !== 'a' || !Object.hasOwn(element.attrs, 'href')) return null
  const href = element.attrs.href.trim()
  return href ? { type: 'URL', value: href } : null
}

/**
 * Characters of `text` in `style`. A line break inside a block starts a paragraph of the
 * block's kind, as text in Figma breaks into paragraphs at every newline.
 */
function addCharacters(collector: Collector, text: string, style: DesignStyleDeclaration): void {
  const value = preservesWhitespace(style) ? text : text.replaceAll(/\s+/g, ' ')
  const characterStyle = characterStyleFromCSS(style, collector.base)
  for (const [index, line] of value.split('\n').entries()) {
    if (index > 0) {
      const paragraph = collector.paragraphs.at(-1)
      if (paragraph) {
        collector.spaceAfter.push(0)
        collector.paragraphs.push({ ...paragraph })
        collector.indents.push(0)
      }
      appendCharacters(collector, '\n', characterStyle)
    }
    appendCharacters(collector, line, characterStyle)
  }
}

function addInline(
  collector: Collector,
  nodes: readonly DesignNode[],
  style: DesignStyleDeclaration
) {
  for (const node of nodes) {
    if (node.type === 'text') addCharacters(collector, node.text, style)
    else if (isBreak(node)) addCharacters(collector, '\n', { ...style, 'white-space': 'pre' })
    else if (!LIST_TAGS.has(node.tagName.toLowerCase())) {
      const around = collector.link
      collector.link = elementLink(node) ?? around
      addInline(collector, node.children, characterDeclarations(node, style))
      collector.link = around
    }
  }
}

function isBreak(node: DesignNode): boolean {
  return node.type === 'element' && node.tagName.toLowerCase() === 'br'
}

function margin(element: DesignElement, side: 'top' | 'bottom'): number {
  return Math.max(0, pixels(pickStyle(mergedStyle(element), `margin-${side}`)) ?? 0)
}

/** Starts a paragraph, ending the one before with the space collected since it. */
function startParagraph(collector: Collector, style: TextParagraphStyle, indent: number): void {
  if (collector.paragraphs.length > 0) {
    collector.spaceAfter.push(collector.pending)
    appendCharacters(collector, '\n', collector.styles.at(-1) ?? collector.base)
  }
  collector.pending = 0
  collector.paragraphs.push(style)
  collector.indents.push(indent)
}

/** A paragraph's characters, trimmed of the spaces that CSS drops at a block's edges. */
function addParagraph(
  collector: Collector,
  nodes: readonly DesignNode[],
  style: DesignStyleDeclaration,
  paragraph: TextParagraphStyle,
  indent: number
): void {
  startParagraph(collector, paragraph, indent)
  // A line break that ends a block adds no line: it gives an empty block its height.
  const content = isBreak(nodes.at(-1) ?? { type: 'text', text: '' }) ? nodes.slice(0, -1) : nodes
  addTrimmed(collector, content, style)
}

/** Inline content, trimmed of the spaces CSS drops at a block's edges unless it keeps them. */
function addTrimmed(
  collector: Collector,
  nodes: readonly DesignNode[],
  style: DesignStyleDeclaration
): void {
  const start = collector.text.length
  addInline(collector, nodes, style)
  if (preservesWhitespace(style)) return
  const added = collector.text.slice(start)
  const leading = added.length - added.trimStart().length
  const trimmed = added.trim()
  collector.text = collector.text.slice(0, start) + trimmed
  collector.styles = [
    ...collector.styles.slice(0, start),
    ...collector.styles.slice(start + leading, start + leading + trimmed.length)
  ]
}

function addList(
  collector: Collector,
  list: DesignElement,
  around: DesignStyleDeclaration,
  level: number
): void {
  const listStyle = characterDeclarations(list, around)
  collector.pending = Math.max(collector.pending, margin(list, 'top'))
  if (level === 1 && collector.hangingList === undefined) {
    collector.hangingList = pixels(pickStyle(mergedStyle(list), 'padding-inline-start')) === 0
  }
  const listType = list.tagName.toLowerCase() === 'ol' ? 'ORDERED' : 'UNORDERED'
  for (const item of list.children) {
    if (item.type !== 'element') continue
    const itemStyle = characterDeclarations(item, listStyle)
    const inline = item.children.filter(
      (child) => child.type === 'text' || !LIST_TAGS.has(child.tagName.toLowerCase())
    )
    collector.pending = Math.max(collector.pending, margin(item, 'top'))
    // An item holding only a nested list, as a skipped level is written, is no paragraph.
    if (inline.some((child) => !isWhitespace(child))) {
      addParagraph(collector, inline, itemStyle, { listType, indentation: level }, 0)
    }
    for (const child of item.children) {
      if (child.type === 'element' && LIST_TAGS.has(child.tagName.toLowerCase())) {
        addList(collector, child, itemStyle, level + 1)
      }
    }
    collector.pending = Math.max(collector.pending, margin(item, 'bottom'))
  }
  collector.pending = Math.max(collector.pending, margin(list, 'bottom'))
}

/** Runs of characters whose style differs from the text's own. */
function styleRunsFrom(styles: readonly CharacterOfText[], base: CSSCharacterStyle): StyleRun[] {
  const runs: StyleRun[] = []
  for (const [index, style] of styles.entries()) {
    const override: CharacterStyleOverride = {}
    for (const key of Object.keys(style) as (keyof CharacterOfText)[]) {
      const own = key === 'hyperlink' ? undefined : base[key]
      if (!isEqual(style[key], own)) Object.assign(override, { [key]: style[key] })
    }
    const previous = runs.at(-1)
    if (
      previous &&
      previous.start + previous.length === index &&
      isEqual(previous.style, override)
    ) {
      previous.length++
    } else if (Object.keys(override).length > 0) {
      runs.push({ start: index, length: 1, style: override })
    }
  }
  return runs
}

function richTextFrom(collector: Collector): RichText {
  return {
    text: collector.text,
    styleRuns: styleRunsFrom(collector.styles, collector.base),
    textParagraphs: collector.paragraphs,
    spaceAfter: collector.spaceAfter,
    indents: collector.indents,
    hangingList: collector.hangingList ?? false
  }
}

function collector(base: CSSCharacterStyle, link: HyperlinkTarget | null): Collector {
  return {
    base,
    text: '',
    styles: [],
    link,
    paragraphs: [],
    spaceAfter: [],
    indents: [],
    pending: 0,
    hangingList: undefined
  }
}

/** An element of inline content as one paragraph of text, its spans as runs. */
export function inlineRichText(
  element: DesignElement,
  style: DesignStyleDeclaration,
  base: CSSCharacterStyle
): RichText {
  // A link the element is itself, as an `<a>` holding spans, links all its characters.
  const text = collector(base, elementLink(element))
  addTrimmed(text, element.children, characterDeclarations(element, style))
  return richTextFrom(text)
}

/** An element of text blocks as paragraphs of one text, its spans as runs. */
export function blockRichText(
  element: DesignElement,
  style: DesignStyleDeclaration,
  base: CSSCharacterStyle
): RichText {
  const text = collector(base, elementLink(element))
  const around = characterDeclarations(element, style)
  const blocks = LIST_TAGS.has(element.tagName.toLowerCase()) ? [element] : element.children
  for (const block of blocks) {
    if (block.type !== 'element') continue
    if (LIST_TAGS.has(block.tagName.toLowerCase())) {
      addList(text, block, around, 1)
      continue
    }
    text.pending = Math.max(text.pending, margin(block, 'top'))
    const blockStyle = characterDeclarations(block, around)
    const indent = Math.max(0, pixels(pickStyle(mergedStyle(block), 'text-indent')) ?? 0)
    addParagraph(text, block.children, blockStyle, { listType: 'NONE', indentation: 0 }, indent)
    text.pending = Math.max(text.pending, margin(block, 'bottom'))
  }
  return richTextFrom(text)
}

/** The value most gaps of a kind share, which the text holds; the others are the paragraphs'. */
function sharedValue(values: readonly number[]): number {
  const counts = countBy(values, String)
  const shared = Object.entries(counts)
    .toSorted((a, b) => b[1] - a[1])
    .at(0)
  return shared ? Number(shared[0]) : 0
}

/** Paragraph styles with the spacing and indents of the text's blocks, by Figma's rules. */
export function applyParagraphs(node: SceneNode, rich: RichText): void {
  const { textParagraphs: paragraphs, spaceAfter, indents } = rich
  const betweenItems = (index: number) =>
    paragraphs[index]?.listType !== 'NONE' && paragraphs[index + 1]?.listType !== 'NONE'
  const gaps = spaceAfter.map((space, index) => ({ space, list: betweenItems(index) }))
  node.paragraphSpacing = sharedValue(gaps.filter((gap) => !gap.list).map((gap) => gap.space))
  node.listSpacing = sharedValue(gaps.filter((gap) => gap.list).map((gap) => gap.space))
  node.paragraphIndent = sharedValue(
    indents.filter((_, index) => paragraphs[index]?.listType === 'NONE')
  )
  node.hangingList = rich.hangingList
  const styles = paragraphs.map((paragraph, index) => {
    const style: TextParagraphStyle = { ...paragraph }
    const gap = gaps.at(index)
    const field = gap?.list ? 'listSpacing' : 'paragraphSpacing'
    if (gap && gap.space !== node[field]) style[field] = gap.space
    if (paragraph.listType === 'NONE' && indents[index] !== node.paragraphIndent) {
      style.paragraphIndent = indents[index]
    }
    return style
  })
  const plain = styles.every(
    (style) => style.listType === 'NONE' && Object.keys(style).length === 2
  )
  node.textParagraphs = plain ? [] : styles
}
