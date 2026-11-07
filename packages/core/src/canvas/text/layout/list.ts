import type { CharacterStyleOverride, StyleRun } from '@open-pencil/scene-graph'
import { rangeFontStyle } from '@open-pencil/scene-graph/shared-styles'
import type { TextListItem } from '@open-pencil/scene-graph/text'

import type { TextLayoutMarker } from '#core/canvas/text/layout/block'
import type { ParagraphBuildOptions } from '#core/canvas/text/paint'
import { buildSkParagraph } from '#core/canvas/text/paragraph'
import type { ParagraphNode } from '#core/canvas/text/paragraph/inputs'
import type { TextRenderer } from '#core/canvas/text/renderer'
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from '#core/constants'
import { glyphAdvanceSync } from '#core/text/font/glyphs'
import { textFontFace } from '#core/text/requirements/collect'

/** A list item's indent per level, in ems of the list's first character. */
const LIST_INDENT_EMS = 1.5
/**
 * Figma widens ordered lists by the advance of glyph 48 per extra digit: the character code of
 * "0" read as a glyph ID. Measured in live Figma for Inter, Roboto, DM Sans, and others.
 */
const LIST_DIGIT_GLYPH_ID = 48
/** A digit's width, in ems, for a font whose glyphs cannot be read. */
const FALLBACK_DIGIT_EMS = 0.6
function styleAt(runs: readonly StyleRun[], index: number): CharacterStyleOverride | undefined {
  return runs.find((run) => index >= run.start && index < run.start + run.length)?.style
}

export interface ListStyle {
  em: number
  family: string
  style: string
  /** The name of the first character's face, which its markers are drawn in. */
  faceName: string | null
  /** The list's first character's style, which its markers take. */
  override: CharacterStyleOverride | undefined
}

export function listStyle(node: ParagraphNode, firstCharacter: number): ListStyle {
  const override = styleAt(node.styleRuns, firstCharacter)
  return {
    em: override?.fontSize ?? (node.fontSize || DEFAULT_FONT_SIZE),
    family: override?.fontFamily ?? (node.fontFamily || DEFAULT_FONT_FAMILY),
    style: textFontFace(node, override).style,
    faceName: rangeFontStyle(node, override ?? {}),
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
    fontStyle: style.faceName,
    letterSpacing: override?.letterSpacing ?? node.letterSpacing,
    lineHeight: override?.lineHeight !== undefined ? override.lineHeight : node.lineHeight,
    fontVariations: override?.fontVariations ?? node.fontVariations,
    opticalSizeFromFontSize: override?.opticalSizeFromFontSize ?? node.opticalSizeFromFontSize,
    fontFeatures:
      item.listType === 'ORDERED' ? [...features, { tag: 'TNUM', enabled: true }] : features,
    textLanguage: override?.textLanguage !== undefined ? override.textLanguage : node.textLanguage,
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
 * How far a list item's text stands from the start edge: its level's indent, widened for
 * ordered items by the digits past the first of the largest top-level number. A hanging list
 * moves the items back by one level, so markers stand outside the text box.
 */
export function listInset(
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

export function buildMarker(
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
