import { isEmptyObject, isEqual } from 'es-toolkit/predicate'
import type { PhrasingContent, RootContent } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { toString } from 'mdast-util-to-string'
import { gfm } from 'micromark-extension-gfm'

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

function codeStyle(style: Style, base: MarkdownBase): Style {
  const weight = style.fontWeight ?? base.fontWeight
  return { ...style, fontFamily: CODE_FAMILY, fontWeight: weight >= CODE_BOLD_FROM ? BOLD : 500 }
}

function phrasing(nodes: readonly PhrasingContent[], style: Style, base: MarkdownBase): Segment[] {
  return nodes.flatMap((node): Segment[] => {
    switch (node.type) {
      case 'text':
        return [{ text: node.value, style }]
      case 'strong':
        return phrasing(node.children, { ...style, fontWeight: BOLD }, base)
      case 'emphasis':
        return phrasing(node.children, { ...style, italic: true }, base)
      case 'delete':
        return phrasing(node.children, { ...style, textDecoration: 'STRIKETHROUGH' }, base)
      case 'inlineCode':
        return [{ text: node.value, style: codeStyle(style, base) }]
      case 'link':
        return phrasing(
          node.children,
          { ...style, hyperlink: { type: 'URL', value: node.url } },
          base
        )
      case 'break':
        return [{ text: '\n', style }]
      case 'image':
        return node.alt ? [{ text: node.alt, style }] : []
      case 'html':
        return [{ text: node.value, style }]
      default:
        return [{ text: toString(node), style }]
    }
  })
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
  base: MarkdownBase,
  depth: number
): Paragraph[] {
  return nodes.flatMap((node): Paragraph[] => {
    switch (node.type) {
      case 'paragraph':
        return splitBreaks(phrasing(node.children, style, base), paragraph)
      case 'heading': {
        const scale = HEADING_SCALE[node.depth]
        const heading: Style = {
          ...style,
          fontWeight: BOLD,
          lineHeight: HEADING_LINE_HEIGHT,
          ...(scale ? { fontSize: base.fontSize * scale } : {})
        }
        return splitBreaks(phrasing(node.children, heading, base), paragraph)
      }
      case 'blockquote':
        return blocks(node.children, { ...style, italic: true }, paragraph, base, depth)
      case 'list':
        return node.children.flatMap((item) =>
          item.children.flatMap((child, index) => {
            // An item's first block is its bullet; a nested list goes a level deeper.
            if (child.type === 'list') return blocks([child], style, paragraph, base, depth + 1)
            const itemStyle = index === 0 ? listStyle(node.ordered === true, depth + 1) : paragraph
            return blocks([child], style, itemStyle, base, depth)
          })
        )
      case 'code':
        return node.value.split('\n').map((line) => ({
          segments: line ? [{ text: line, style: codeStyle(style, base) }] : [],
          style: paragraph
        }))
      case 'table':
        // A row reads as its cells apart by tabs; the text model has no tables.
        return node.children.map((row) => ({
          segments: row.children.flatMap((cell, index) => [
            ...(index > 0 ? [{ text: '\t', style }] : []),
            ...phrasing(cell.children, style, base)
          ]),
          style: paragraph
        }))
      case 'html':
        return splitBreaks([{ text: node.value, style }], paragraph)
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
  const paragraphs = blocks(root.children, {}, PLAIN_PARAGRAPH, base, 0)
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
