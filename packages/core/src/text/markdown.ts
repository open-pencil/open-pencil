import { isEmptyObject, isEqual } from 'es-toolkit/predicate'
import type { Nodes, PhrasingContent, RootContent } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { toString } from 'mdast-util-to-string'
import { gfm } from 'micromark-extension-gfm'
import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5'

import type {
  CharacterStyleOverride,
  SceneNode,
  StyleRun,
  TextParagraphStyle
} from '@open-pencil/scene-graph'
import {
  MAX_LIST_INDENTATION,
  PLAIN_PARAGRAPH,
  trimParagraphStyles
} from '@open-pencil/scene-graph/text'

/** The style of the text Markdown is written into, which headings and code are relative to. */
export type MarkdownBase = Pick<SceneNode, 'fontSize' | 'fontWeight'>

/** A text's characters, ranges, and paragraphs, as Markdown gives them. */
export interface MarkdownText {
  text: string
  styleRuns: StyleRun[]
  textParagraphs: TextParagraphStyle[]
}

/** FigJam's heading sizes, as multiples of the text's own size; deeper levels keep it. */
const HEADING_SCALE: Readonly<Partial<Record<number, number>>> = { 1: 2.5, 2: 1.5 }
const HEADING_LINE_HEIGHT = { unit: 'PERCENT', value: 150 } as const
const BOLD = 700
/** FigJam sets inline code in Roboto Mono, Medium below SemiBold and Bold from it. */
const CODE_FAMILY = 'Roboto Mono'
const CODE_BOLD_FROM = 600

type Style = CharacterStyleOverride

interface Segment {
  text: string
  style: Style
}

interface Paragraph {
  segments: Segment[]
  style: TextParagraphStyle
}

/** What reading one Markdown source shares: the text's style, and its link definitions by label. */
interface Reading {
  base: MarkdownBase
  definitions: ReadonlyMap<string, string>
}

/** The URL each `[label]: url` definition gives, wherever it sits, by its normalized label. */
function linkDefinitions(node: Nodes, found = new Map<string, string>()): Map<string, string> {
  if (node.type === 'definition' && !found.has(node.identifier))
    found.set(node.identifier, node.url)
  if ('children' in node) for (const child of node.children) linkDefinitions(child, found)
  return found
}

function codeStyle(style: Style, { base }: Reading): Style {
  const weight = style.fontWeight ?? base.fontWeight
  return { ...style, fontFamily: CODE_FAMILY, fontWeight: weight >= CODE_BOLD_FROM ? BOLD : 500 }
}

function phrasing(nodes: readonly PhrasingContent[], style: Style, reading: Reading): Segment[] {
  return nodes.flatMap((node): Segment[] => {
    switch (node.type) {
      case 'text':
        return [{ text: node.value, style }]
      case 'strong':
        return phrasing(node.children, { ...style, fontWeight: BOLD }, reading)
      case 'emphasis':
        return phrasing(node.children, { ...style, italic: true }, reading)
      case 'delete':
        return phrasing(node.children, { ...style, textDecoration: 'STRIKETHROUGH' }, reading)
      case 'inlineCode':
        return [{ text: node.value, style: codeStyle(style, reading) }]
      case 'link':
        return phrasing(node.children, linked(style, node.url), reading)
      case 'linkReference': {
        // `[text][label]` links to the URL its definition gives, wherever that is written.
        const url = reading.definitions.get(node.identifier)
        return phrasing(node.children, url ? linked(style, url) : style, reading)
      }
      case 'break':
        return [{ text: '\n', style }]
      case 'image':
        return node.alt ? [{ text: node.alt, style }] : []
      case 'html': {
        // An inline tag only marks up the words around it; a `<br>` still breaks the line.
        const words = htmlWords(node.value)
        return words ? [{ text: words, style }] : []
      }
      default:
        return [{ text: toString(node), style }]
    }
  })
}

/** Elements whose content HTML never shows. */
const HIDDEN_ELEMENTS = new Set(['script', 'style', 'template', 'head', 'title'])

/** Elements HTML lays out as blocks of their own, which start a line. */
const BLOCK_ELEMENTS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'dd',
  'details',
  'div',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'summary',
  'table',
  'tr',
  'ul'
])

/** Where a block element starts or ends, which several in a row make one line break. */
const BLOCK_EDGE = '\u0000'

function htmlContent(nodes: DefaultTreeAdapterTypes.ChildNode[]): string {
  return nodes
    .map((node) => {
      if (node.nodeName === '#text' && 'value' in node) return node.value
      if (node.nodeName === 'br') return '\n'
      if (HIDDEN_ELEMENTS.has(node.nodeName) || !('childNodes' in node)) return ''
      const words = htmlContent(node.childNodes)
      return BLOCK_ELEMENTS.has(node.nodeName) ? `${BLOCK_EDGE}${words}${BLOCK_EDGE}` : words
    })
    .join('')
}

/**
 * The words HTML shows: a `<br>` breaks the line and a block element sits on lines of its own,
 * while inline tags only mark up their words and hidden content shows nothing.
 */
function htmlWords(html: string): string {
  const content = htmlContent(parseFragment(html).childNodes)
  const edges = new RegExp(`${BLOCK_EDGE}+`, 'g')
  return content.replace(edges, (edge, at: number) =>
    at === 0 || at + edge.length === content.length ? '' : '\n'
  )
}

function linked(style: Style, url: string): Style {
  return { ...style, hyperlink: { type: 'URL', value: url } }
}

/** Paragraphs of segments, a hard break inside one starting another of the same style. */
function splitBreaks(segments: Segment[], style: TextParagraphStyle): Paragraph[] {
  const paragraphs: Paragraph[] = [{ segments: [], style }]
  for (const segment of segments) {
    const lines = segment.text.split('\n')
    for (const [index, line] of lines.entries()) {
      if (index > 0) paragraphs.push({ segments: [], style })
      if (line) paragraphs.at(-1)?.segments.push({ text: line, style: segment.style })
    }
  }
  return paragraphs
}

function listStyle(ordered: boolean, depth: number): TextParagraphStyle {
  return {
    listType: ordered ? 'ORDERED' : 'UNORDERED',
    indentation: Math.min(depth, MAX_LIST_INDENTATION)
  }
}

function blocks(
  nodes: readonly RootContent[],
  style: Style,
  paragraph: TextParagraphStyle,
  reading: Reading,
  depth: number
): Paragraph[] {
  return nodes.flatMap((node): Paragraph[] => {
    switch (node.type) {
      case 'paragraph':
        return splitBreaks(phrasing(node.children, style, reading), paragraph)
      case 'heading': {
        const scale = HEADING_SCALE[node.depth]
        const heading: Style = {
          ...style,
          fontWeight: BOLD,
          lineHeight: HEADING_LINE_HEIGHT,
          ...(scale ? { fontSize: reading.base.fontSize * scale } : {})
        }
        return splitBreaks(phrasing(node.children, heading, reading), paragraph)
      }
      case 'blockquote':
        return blocks(node.children, { ...style, italic: true }, paragraph, reading, depth)
      case 'list':
        return node.children.flatMap((item) => {
          const bullet = listStyle(node.ordered === true, depth + 1)
          // An empty item is still a bullet of its own.
          if (item.children.length === 0) return [{ segments: [], style: bullet }]
          return item.children.flatMap((child, index) => {
            // An item's first block is its bullet; a nested list goes a level deeper, under a
            // bullet of the item's own when the item holds nothing before it.
            if (child.type === 'list') {
              const own = index === 0 ? [{ segments: [], style: bullet }] : []
              return [...own, ...blocks([child], style, paragraph, reading, depth + 1)]
            }
            return blocks([child], style, index === 0 ? bullet : paragraph, reading, depth)
          })
        })
      case 'code':
        return node.value.split('\n').map((line) => ({
          segments: line ? [{ text: line, style: codeStyle(style, reading) }] : [],
          style: paragraph
        }))
      case 'table':
        // A row reads as its cells apart by tabs; the text model has no tables.
        return node.children.map((row) => ({
          segments: row.children.flatMap((cell, index) => [
            ...(index > 0 ? [{ text: '\t', style }] : []),
            ...phrasing(cell.children, style, reading)
          ]),
          style: paragraph
        }))
      case 'html': {
        // Only the blank lines around the block go; a `<pre>` keeps the spaces it shows.
        const words = htmlWords(node.value).replace(/^\n+|\n+$/g, '')
        return words ? splitBreaks([{ text: words, style }], paragraph) : []
      }
      case 'thematicBreak':
      case 'definition':
      case 'footnoteDefinition':
      case 'yaml':
        return []
      default:
        return splitBreaks([{ text: toString(node), style }], paragraph)
    }
  })
}

/** The style a run keeps: what differs from the text's own. */
function ownStyle(style: Style, base: MarkdownBase): Style {
  const own = { ...style }
  if (own.fontWeight === base.fontWeight) delete own.fontWeight
  if (own.fontSize === base.fontSize) delete own.fontSize
  return own
}

/**
 * Text written in Markdown as a text's characters, ranges, and paragraphs, styled as FigJam
 * styles Markdown typed into a text: headings bold at 2.5×, 1.5×, or the text's own size with
 * a 150% line height, bold and italic in the text's family, inline code in Roboto Mono, lists
 * and quotes as paragraphs. Links keep their URL; content the text model has no place for, such
 * as images and rules, keeps its words or is left out.
 */
export function markdownText(markdown: string, base: MarkdownBase): MarkdownText {
  const root = fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })
  const reading = { base, definitions: linkDefinitions(root) }
  const paragraphs = blocks(root.children, {}, PLAIN_PARAGRAPH, reading, 0)
  if (paragraphs.length === 0) return { text: '', styleRuns: [], textParagraphs: [] }

  const runs: StyleRun[] = []
  let text = ''
  for (const [index, paragraph] of paragraphs.entries()) {
    // A newline takes the style of the character before it, as in Figma.
    const segments =
      index < paragraphs.length - 1
        ? [...paragraph.segments, { text: '\n', style: paragraph.segments.at(-1)?.style ?? {} }]
        : paragraph.segments
    for (const segment of segments) {
      const style = ownStyle(segment.style, base)
      const previous = runs.at(-1)
      if (!isEmptyObject(style)) {
        if (
          previous &&
          previous.start + previous.length === text.length &&
          isEqual(previous.style, style)
        )
          previous.length += segment.text.length
        else runs.push({ start: text.length, length: segment.text.length, style })
      }
      text += segment.text
    }
  }
  const styles = paragraphs.map((paragraph) => ({ ...paragraph.style }))
  return { text, styleRuns: runs, textParagraphs: trimParagraphStyles(styles, styles.length) }
}
