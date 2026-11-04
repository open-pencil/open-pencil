import type {
  LetterSpacing,
  LineHeight,
  TextListOptions
} from '@figma/plugin-typings/plugin-api-standalone'
import { upperFirst } from 'es-toolkit/string'
import * as v from 'valibot'

import type {
  SceneGraph,
  SceneNode,
  StyleRun,
  TextLength,
  TextParagraphSpacingField,
  TextParagraphStyle
} from '@open-pencil/scene-graph'
import { recordInstanceOverride } from '@open-pencil/scene-graph/instances'
import {
  MAX_LIST_INDENTATION,
  paragraphIndexAt,
  paragraphStyleAt,
  paragraphStylesAfterEdit,
  paragraphStylesInRange,
  pixelLength,
  sharedParagraphSpacing,
  textParagraphRanges,
  trimParagraphStyles,
  withIndentation,
  withListType,
  withParagraphSpacing
} from '@open-pencil/scene-graph/text'

import { lengthOrAuto, letterSpacingLength } from '#core/figma-api/accessors/text/values'
import { assertTextFontsLoaded } from '#core/figma-api/fonts/loaded'
import { atLeast, finiteNumberSchema } from '#core/figma-api/schema'
import { parseFigma } from '#core/figma-api/validation'
import {
  adjustRunsForDelete,
  getStyleAt,
  insertedStyleAt,
  insertRunsWithStyle,
  type InsertStyleSource
} from '#core/text/style-runs'

import { assertTextRange } from './style'

/** Figma's `LineHeight`: automatic, or a size in pixels or percent of the font size. */
export type FigmaLineHeight = LineHeight
/** Figma's `LetterSpacing`, in pixels or percent of the font size. */
export type FigmaLetterSpacing = LetterSpacing

/**
 * Accepts Figma's object, kept in its unit so a percent follows the font size as in Figma, or a
 * bare number of pixels or `null` for automatic, as earlier OpenPencil scripts wrote it.
 */
export function lineHeightValue(value: unknown): TextLength | null {
  if (value === null) return null
  if (typeof value === 'number') return pixelLength(value)
  return lengthOrAuto('set_lineHeight', value, 'lineHeight')
}

/** Accepts Figma's object, in its unit, or a bare number of pixels as earlier scripts wrote it. */
export function letterSpacingValue(value: unknown): TextLength {
  if (typeof value === 'number') return pixelLength(value)
  return letterSpacingLength('set_letterSpacing', value, 'letterSpacing')
}

export type { InsertStyleSource }

const INSERT_STYLE_SOURCES = ['BEFORE', 'AFTER'] as const satisfies readonly InsertStyleSource[]

/**
 * A text's style runs once its characters are replaced. Figma resets the styles applied to
 * character ranges, so the whole text keeps the style of its first character.
 */
export function styleRunsForCharacters(node: SceneNode, characters: string): StyleRun[] {
  const first = node.text.length > 0 ? getStyleAt(node.styleRuns, 0) : {}
  if (characters.length === 0 || Object.keys(first).length === 0) return []
  return [{ start: 0, length: characters.length, style: { ...first } }]
}

export function insertCharacters(
  graph: SceneGraph,
  node: SceneNode,
  start: number,
  characters: string,
  useStyle: InsertStyleSource = 'BEFORE'
): void {
  // Scripts are not type-checked, so the value is checked as Figma checks it.
  parseFigma(v.picklist(INSERT_STYLE_SOURCES), useStyle, 'insertCharacters', 'useStyle')
  assertEditPosition('insertCharacters', node, 'start', start)
  assertTextFontsLoaded('insertCharacters', node)
  const text = node.text.slice(0, start) + characters + node.text.slice(start)
  const textParagraphs = paragraphStylesAfterEdit(
    node.textParagraphs,
    node.text,
    start,
    start,
    characters
  )
  const styleRuns = insertRunsWithStyle(
    node.styleRuns,
    start,
    characters.length,
    insertedStyleAt(node.styleRuns, node.text.length, start, useStyle)
  )
  graph.updateNode(node.id, { text, textParagraphs, styleRuns })
  recordInstanceOverride(graph, node.id, ['text', 'textParagraphs', 'styleRuns'])
}

const editPositionSchema = v.pipe(finiteNumberSchema, v.integer(), v.minValue(0))

/**
 * A position an edit can use: an integer from 0 through the text length, the end included,
 * refused with Figma's messages.
 */
function assertEditPosition(
  method: 'insertCharacters' | 'deleteCharacters',
  node: SceneNode,
  name: string,
  value: number
) {
  parseFigma(editPositionSchema, value, method, name)
  if (value > node.text.length) {
    const verb = method === 'insertCharacters' ? 'insert' : 'delete'
    throw new Error(
      `in ${method}: Cannot ${verb} characters at index greater than the length of the text`
    )
  }
}

export function deleteCharacters(
  graph: SceneGraph,
  node: SceneNode,
  start: number,
  end: number
): void {
  assertEditPosition('deleteCharacters', node, 'start', start)
  assertEditPosition('deleteCharacters', node, 'end', end)
  if (end < start) {
    throw new Error('in deleteCharacters: deleteCharacters must have (start <= end)')
  }
  assertTextFontsLoaded('deleteCharacters', node)
  const text = node.text.slice(0, start) + node.text.slice(end)
  const textParagraphs = paragraphStylesAfterEdit(node.textParagraphs, node.text, start, end, '')
  const styleRuns = adjustRunsForDelete(node.styleRuns, start, end - start)
  graph.updateNode(node.id, { text, textParagraphs, styleRuns })
  recordInstanceOverride(graph, node.id, ['text', 'textParagraphs', 'styleRuns'])
}

type ListType = TextListOptions['type']
const listOptionsSchema = v.strictObject({
  type: v.picklist(['NONE', 'ORDERED', 'UNORDERED'] as const satisfies readonly ListType[])
})

/** The styles of the paragraphs a range touches: a newline belongs to the paragraph it ends. */
function rangeParagraphStyles(node: SceneNode, start: number, end: number): TextParagraphStyle[] {
  const first = paragraphIndexAt(node.text, start)
  const last = paragraphIndexAt(node.text, end - 1)
  return Array.from({ length: last - first + 1 }, (_, index) =>
    paragraphStyleAt(node.textParagraphs, first + index)
  )
}

function updateParagraphs(
  graph: SceneGraph,
  node: SceneNode,
  start: number,
  end: number,
  change: (style: TextParagraphStyle) => TextParagraphStyle
): void {
  const textParagraphs = paragraphStylesInRange(node.textParagraphs, node.text, start, end, change)
  graph.updateNode(node.id, { textParagraphs })
  recordInstanceOverride(graph, node.id, ['textParagraphs'])
}

export function getRangeListOptions(
  node: SceneNode,
  start: number,
  end: number,
  mixed: symbol
): TextListOptions | symbol {
  assertTextRange('getRangeListOptions', node, start, end)
  const types = new Set(rangeParagraphStyles(node, start, end).map((style) => style.listType))
  const [type] = types
  return types.size === 1 ? { type } : mixed
}

export function setRangeListOptions(
  graph: SceneGraph,
  node: SceneNode,
  start: number,
  end: number,
  value: TextListOptions
): void {
  const { type } = parseFigma(listOptionsSchema, value, 'setRangeListOptions', 'options')
  assertTextRange('setRangeListOptions', node, start, end)
  assertTextFontsLoaded('setRangeListOptions', node)
  updateParagraphs(graph, node, start, end, (style) => withListType(style, type))
}

export function getRangeIndentation(
  node: SceneNode,
  start: number,
  end: number,
  mixed: symbol
): number | symbol {
  assertTextRange('getRangeIndentation', node, start, end)
  const levels = new Set(rangeParagraphStyles(node, start, end).map((style) => style.indentation))
  const [level] = levels
  return levels.size === 1 ? level : mixed
}

/** A whole level of nesting; Figma stops at a fraction before checking the bounds. */
const indentationSchema = v.config(
  v.pipe(finiteNumberSchema, v.integer(), v.minValue(0), v.maxValue(MAX_LIST_INDENTATION)),
  { abortPipeEarly: true }
)

export function setRangeIndentation(
  graph: SceneGraph,
  node: SceneNode,
  start: number,
  end: number,
  level: number
): void {
  parseFigma(indentationSchema, level, 'setRangeIndentation', 'indentation')
  assertTextRange('setRangeIndentation', node, start, end)
  assertTextFontsLoaded('setRangeIndentation', node)
  updateParagraphs(graph, node, start, end, (style) => withIndentation(style, level))
}

/**
 * The paragraphs a spacing range reaches. Unlike list options, Figma counts the paragraph at the
 * range's end position too, so a range ending where a paragraph starts reaches it.
 */
function spacingParagraphs(node: SceneNode, start: number, end: number): [number, number] {
  return [paragraphIndexAt(node.text, start), paragraphIndexAt(node.text, end)]
}

export function getRangeParagraphSpacing(
  node: SceneNode,
  field: TextParagraphSpacingField,
  start: number,
  end: number,
  mixed: symbol
): number | symbol {
  assertTextRange(`getRange${upperFirst(field)}`, node, start, end)
  return sharedParagraphSpacing(node, field, ...spacingParagraphs(node, start, end)) ?? mixed
}

export function setRangeParagraphSpacing(
  graph: SceneGraph,
  node: SceneNode,
  field: TextParagraphSpacingField,
  start: number,
  end: number,
  value: number
): void {
  const method = `setRange${upperFirst(field)}`
  parseFigma(atLeast(0), value, method)
  assertTextRange(method, node, start, end)
  assertTextFontsLoaded(method, node)
  // Ranges change the paragraphs of their characters; one more reaches the end position's.
  updateParagraphs(graph, node, start, end + 1, (style) =>
    withParagraphSpacing(style, field, value)
  )
}

/** A text's spacing: one value when every paragraph has it, `mixed` otherwise. */
export function getParagraphSpacing(
  node: SceneNode,
  field: TextParagraphSpacingField,
  mixed: symbol
): number | symbol {
  return sharedParagraphSpacing(node, field) ?? mixed
}

/** Text replaced whole takes the first paragraph's list style throughout, as in Figma. */
export function paragraphStylesForCharacters(node: SceneNode, text: string): TextParagraphStyle[] {
  if (node.textParagraphs.length === 0) return []
  const first = paragraphStyleAt(node.textParagraphs, 0)
  const count = textParagraphRanges(text).length
  return trimParagraphStyles(
    Array.from({ length: count }, () => first),
    count
  )
}
