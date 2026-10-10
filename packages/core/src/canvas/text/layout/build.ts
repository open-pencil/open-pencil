import type { Paragraph } from 'canvaskit-wasm'

import {
  hasTextList,
  paragraphStyleAt,
  textListItems,
  textParagraphRanges,
  topLevelNumberDigits,
  type CharacterStyleOverride,
  type StyleRun,
  type TextListItem,
  type TextParagraphRange
} from '@open-pencil/scene-graph'
import { resolveNodeTextDirection } from '@open-pencil/scene-graph/text-direction'

import type { ParagraphBuildOptions } from '#core/canvas/text/paint'
import {
  buildSkParagraph,
  buildTruncateOpts,
  resolveParagraphLayoutWidth,
  type ParagraphBlockOptions
} from '#core/canvas/text/paragraph'
import type { ParagraphNode } from '#core/canvas/text/paragraph/inputs'
import type { TextRenderer } from '#core/canvas/text/renderer'
import { utf8Length } from '#core/canvas/text/utf8'
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from '#core/constants'
import { transformTextCase } from '#core/text/case'
import { weightToStyle } from '#core/text/fonts'
import { glyphAdvanceSync } from '#core/text/opentype'

import { TextLayout, type TextLayoutBlock, type TextLayoutMarker } from './text-layout'

/** A list item's indent per level, in ems of the list's first character. */
const LIST_INDENT_EMS = 1.5
/**
 * Figma widens ordered lists by the advance of glyph 48 per extra digit: the character code of
 * "0" read as a glyph ID. Measured in live Figma for Inter, Roboto, DM Sans, and others.
 */
const LIST_DIGIT_GLYPH_ID = 48
/** A digit's width, in ems, for a font whose glyphs cannot be read. */
const FALLBACK_DIGIT_EMS = 0.6
/** The placeholder a first-line indent puts before the text takes one UTF-16 unit, three bytes. */
const PLACEHOLDER_UTF8_LENGTH = 3

function styleAt(runs: readonly StyleRun[], index: number): CharacterStyleOverride | undefined {
  return runs.find((run) => index >= run.start && index < run.start + run.length)?.style
}

/** Style runs of `text[start, end)` in the slice's own indices. */
function sliceStyleRuns(runs: readonly StyleRun[], start: number, end: number): StyleRun[] {
  const sliced: StyleRun[] = []
  for (const run of runs) {
    const from = Math.max(start, run.start)
    const to = Math.min(end, run.start + run.length)
    if (to > from) sliced.push({ start: from - start, length: to - from, style: run.style })
  }
  return sliced
}

/** Whether the text lays out paragraph by paragraph rather than as one native paragraph. */
function needsParagraphLayout(node: ParagraphNode): boolean {
  return hasTextList(node) || node.paragraphSpacing !== 0 || node.paragraphIndent !== 0
}

function layoutForNode(layout: TextLayout, node: ParagraphNode): void {
  if (node.textAutoResize === 'WIDTH_AND_HEIGHT') {
    layout.layout(1e6)
    layout.layout(Math.max(node.width || 1, Math.ceil(layout.getLongestLine())))
  } else {
    layout.layout(resolveParagraphLayoutWidth(node))
  }
}

interface ListStyle {
  em: number
  family: string
  style: string
  /** The list's first character's style, which its markers take. */
  override: CharacterStyleOverride | undefined
}

function listStyle(node: ParagraphNode, firstCharacter: number): ListStyle {
  const override = styleAt(node.styleRuns, firstCharacter)
  return {
    em: override?.fontSize ?? (node.fontSize || DEFAULT_FONT_SIZE),
    family: override?.fontFamily ?? (node.fontFamily || DEFAULT_FONT_FAMILY),
    style: weightToStyle(override?.fontWeight ?? node.fontWeight, override?.italic ?? node.italic),
    override
  }
}

/** A marker in its list's style, without the text's decoration and with figures of one width. */
function markerNode(node: ParagraphNode, item: TextListItem, style: ListStyle): ParagraphNode {
  const override = style.override
  const features = override?.fontFeatures ?? node.fontFeatures
  return {
    ...node,
    text: item.marker,
    fontSize: style.em,
    fontFamily: style.family,
    fontWeight: override?.fontWeight ?? node.fontWeight,
    italic: override?.italic ?? node.italic,
    letterSpacing: override?.letterSpacing ?? node.letterSpacing,
    lineHeight: override?.lineHeight !== undefined ? override.lineHeight : node.lineHeight,
    fontVariations: override?.fontVariations ?? node.fontVariations,
    fontFeatures:
      item.listType === 'ORDERED' ? [...features, { tag: 'TNUM', enabled: true }] : features,
    textLanguage: override?.textLanguage ?? node.textLanguage,
    styleRuns: override?.fills
      ? [{ start: 0, length: item.marker.length, style: { fills: override.fills } }]
      : [],
    textCase: 'ORIGINAL',
    textDecoration: 'NONE',
    textDirection: 'LTR',
    textAlignHorizontal: 'LEFT',
    textAutoResize: 'WIDTH_AND_HEIGHT',
    textTruncation: 'DISABLED',
    maxLines: null
  }
}

/**
 * Text with lists, paragraph spacing, or a first-line indent, laid out one paragraph per
 * native paragraph: Skia has no hanging indent, so each list item lays out at the width its
 * indent leaves, beside a marker of its own.
 */
function buildBlocks(
  r: TextRenderer,
  node: ParagraphNode,
  color: Float32Array | undefined,
  options: ParagraphBuildOptions
): TextLayout {
  const shownText = transformTextCase(node.text, node.textCase)
  const sources = textParagraphRanges(node.text)
  const shown = textParagraphRanges(shownText)
  const items = new Map(
    textListItems(node.text, node.textParagraphs).map((item) => [item.paragraph, item])
  )
  const digits = topLevelNumberDigits([...items.values()])
  const rtl = resolveNodeTextDirection(node) === 'RTL'
  const truncation = buildTruncateOpts(node, node.fontSize || DEFAULT_FONT_SIZE)
  const maxLines = truncation.maxLines
  // Each paragraph starts one byte, its newline, after the one before it ends.
  const utf8Starts: number[] = []
  let utf8Offset = 0
  for (const range of shown) {
    utf8Starts.push(utf8Offset)
    utf8Offset += utf8Length(shownText.slice(range.start, range.end)) + 1
  }

  const blocks: TextLayoutBlock[] = []
  try {
    for (const [index, { start, end }] of sources.entries()) {
      blocks.push(buildBlock(index, start, end))
    }
  } catch (error) {
    // Native paragraphs built before the failure are not garbage collected.
    for (const block of blocks) {
      block.paragraph.delete()
      block.marker?.paragraph.delete()
    }
    throw error
  }
  return new TextLayout(r.ck, blocks, maxLines)

  function buildBlock(index: number, start: number, end: number): TextLayoutBlock {
    const shownRange: TextParagraphRange = shown[index]
    const item = items.get(index)
    const paragraphStyle = paragraphStyleAt(node.textParagraphs, index)
    const empty = end === start
    const blockNode: ParagraphNode = {
      ...node,
      text: empty ? ' ' : node.text.slice(start, end),
      styleRuns: empty
        ? sliceStyleRuns(node.styleRuns, start, start + 1)
        : sliceStyleRuns(node.styleRuns, start, end)
    }
    const firstLineIndent =
      paragraphStyle.listType === 'NONE' && node.paragraphIndent > 0 ? node.paragraphIndent : 0
    const blockOptions = (lines?: number): ParagraphBlockOptions => ({
      firstLineIndent,
      truncation: lines === undefined ? {} : { maxLines: lines, ellipsis: truncation.ellipsis },
      edges: { first: index === 0, last: index === sources.length - 1 }
    })
    const betweenItems =
      index > 0 &&
      paragraphStyleAt(node.textParagraphs, index - 1).listType !== 'NONE' &&
      paragraphStyle.listType !== 'NONE'
    const list = item ? listStyle(node, sources[item.groupStart].start) : null
    const marker = item && list ? buildMarker(r, node, item, list, color, options) : null
    let paragraph: Paragraph
    try {
      paragraph = buildSkParagraph(r, blockNode, color, options, blockOptions(maxLines))
    } catch (error) {
      marker?.paragraph.delete()
      throw error
    }
    return {
      paragraph,
      rebuild:
        maxLines === undefined
          ? undefined
          : (lines) => buildSkParagraph(r, blockNode, color, options, blockOptions(lines)),
      start: shownRange.start,
      utf8Start: utf8Starts[index],
      length: shownRange.end - shownRange.start,
      lead: firstLineIndent > 0 ? 1 : 0,
      utf8Lead: firstLineIndent > 0 ? PLACEHOLDER_UTF8_LENGTH : 0,
      leadWidth: firstLineIndent,
      empty,
      inset: item && list ? listInset(node, item, list, digits) : 0,
      rtl,
      spaceBefore: betweenItems ? node.listSpacing : node.paragraphSpacing,
      marker,
      x: 0,
      y: 0,
      visible: true
    }
  }
}

/**
 * How far a list item's text stands from the start edge: its level's indent, widened for
 * ordered items by the digits past the first of the largest top-level number. A hanging list
 * moves the items back by one level, so markers stand outside the text box.
 */
function listInset(
  node: ParagraphNode,
  item: TextListItem,
  list: ListStyle,
  digits: number
): number {
  const unit = list.em * LIST_INDENT_EMS
  let inset = item.level * unit
  if (item.listType === 'ORDERED' && digits > 1) {
    const digit = glyphAdvanceSync(list.family, list.style, LIST_DIGIT_GLYPH_ID, list.em)
    inset += (digits - 1) * (digit ?? list.em * FALLBACK_DIGIT_EMS)
  }
  return node.hangingList ? inset - unit : inset
}

function buildMarker(
  r: TextRenderer,
  node: ParagraphNode,
  item: TextListItem,
  list: ListStyle,
  color: Float32Array | undefined,
  options: ParagraphBuildOptions
): TextLayoutMarker {
  const paragraph = buildSkParagraph(r, markerNode(node, item, list), color, options)
  paragraph.layout(1e6)
  return {
    paragraph,
    kind: item.listType === 'ORDERED' ? 'number' : 'bullet',
    em: list.em,
    face: { family: list.family, style: list.style },
    x: 0,
    y: 0,
    lineNumber: 0
  }
}

/** Lay a text node out as the renderer draws it, at its own width. */
export function buildParagraph(
  r: TextRenderer,
  node: ParagraphNode,
  color?: Float32Array,
  options: ParagraphBuildOptions = {}
): TextLayout {
  const layout = needsParagraphLayout(node)
    ? buildBlocks(r, node, color, options)
    : TextLayout.ofParagraph(
        r.ck,
        buildSkParagraph(r, node, color, options),
        transformTextCase(node.text, node.textCase).length
      )
  try {
    layoutForNode(layout, node)
    return layout
  } catch (error) {
    layout.delete()
    throw error
  }
}
