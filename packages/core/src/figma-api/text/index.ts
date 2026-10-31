import { compact } from 'es-toolkit/array'
import { upperFirst } from 'es-toolkit/string'

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

import { invalid, received } from '#core/figma-api/accessors/text/messages'
import { assertTextFontsLoaded } from '#core/figma-api/fonts/loaded'
import { adjustRunsForDelete, getStyleAt, insertRunsWithStyle } from '#core/text/style-runs'

import { assertTextRange } from './style'

/** Figma's plugin API line height: automatic, or a size in pixels or percent of the font size. */
export type FigmaLineHeight = { unit: 'AUTO' } | { unit: 'PIXELS' | 'PERCENT'; value: number }
/** Figma's plugin API letter spacing, in pixels or percent of the font size. */
export interface FigmaLetterSpacing {
  unit: 'PIXELS' | 'PERCENT'
  value: number
}

/** Figma's complaint about a length's `.value`, or null when it is a number. */
function amountProblem(amount: unknown): string | null {
  if (amount === undefined) return 'Required value missing at .value'
  // NaN is a number to typeof, but not to Figma's check.
  return typeof amount === 'number' && !Number.isNaN(amount)
    ? null
    : `Expected number, received ${received(amount)} at .value`
}

/** A length object a script passes to `method`, checked as Figma checks it. */
function lengthObject(method: string, property: string, value: unknown) {
  if (typeof value !== 'object' || value === null) {
    throw invalid(method, `Expected object, received ${received(value)}`, property)
  }
  return value as { unit?: unknown; value?: unknown }
}

/**
 * Accepts Figma's object, kept in its unit so a percent follows the font size as in Figma, or a
 * bare number of pixels or `null` for automatic, as earlier OpenPencil scripts wrote it.
 */
export function lineHeightValue(value: unknown): TextLength | null {
  if (value === null) return null
  if (typeof value === 'number') return pixelLength(value)
  const length = lengthObject('set_lineHeight', 'lineHeight', value)
  if (length.unit === 'AUTO') return null
  if (length.unit !== 'PIXELS' && length.unit !== 'PERCENT') {
    throw invalid(
      'set_lineHeight',
      'Expected .unit to be one of the following: PIXELS, PERCENT, AUTO',
      'lineHeight'
    )
  }
  const problem = amountProblem(length.value)
  if (problem) throw invalid('set_lineHeight', problem, 'lineHeight')
  return { unit: length.unit, value: length.value as number }
}

/** Accepts Figma's object, in its unit, or a bare number of pixels as earlier scripts wrote it. */
export function letterSpacingValue(value: unknown): TextLength {
  if (typeof value === 'number') return pixelLength(value)
  const length = lengthObject('set_letterSpacing', 'letterSpacing', value)
  const unitKnown = length.unit === 'PIXELS' || length.unit === 'PERCENT'
  // Figma lists every problem, the value's before the unit's.
  const problems = compact([
    amountProblem(length.value),
    unitKnown ? null : 'Invalid option: expected one of "PIXELS"|"PERCENT" at .unit'
  ])
  if (problems.length > 0) {
    throw invalid('set_letterSpacing', problems.join('\n'), 'letterSpacing')
  }
  return { unit: length.unit as TextLength['unit'], value: length.value as number }
}

/** Which neighbour inserted characters copy their style from, as Figma's `insertCharacters` takes it. */
export type InsertStyleSource = 'BEFORE' | 'AFTER'

const INSERT_STYLE_SOURCES: ReadonlySet<string> = new Set(['BEFORE', 'AFTER'])

/**
 * The style inserted characters take, as Figma gives it: the preceding character's for `BEFORE`
 * and the following one's for `AFTER`, or the closest character's at either end of the text.
 */
function insertedStyle(node: SceneNode, start: number, useStyle: InsertStyleSource) {
  if (node.text.length === 0) return {}
  const preferred = useStyle === 'BEFORE' ? start - 1 : start
  const index = Math.min(Math.max(preferred, 0), node.text.length - 1)
  return getStyleAt(node.styleRuns, index)
}

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
  if (!INSERT_STYLE_SOURCES.has(useStyle)) {
    throw invalid(
      'insertCharacters',
      'Invalid option: expected one of "BEFORE"|"AFTER"',
      'useStyle'
    )
  }
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
    insertedStyle(node, start, useStyle)
  )
  graph.updateNode(node.id, { text, textParagraphs, styleRuns })
  recordInstanceOverride(graph, node.id, ['text', 'textParagraphs', 'styleRuns'])
}

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
  if (!Number.isInteger(value)) throw invalid(method, 'Expected int, received number', name)
  if (value < 0) throw invalid(method, 'Too small: expected number to be >=0', name)
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
const LIST_TYPES: ReadonlySet<string> = new Set<ListType>(['NONE', 'ORDERED', 'UNORDERED'])

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
  options: TextListOptions
): void {
  if (!LIST_TYPES.has(options.type)) {
    throw new Error(
      `in setRangeListOptions: Property "options" failed validation: Invalid enum value. ` +
        `Expected 'NONE' | 'ORDERED' | 'UNORDERED', received '${String(options.type)}' at .type`
    )
  }
  assertTextRange('setRangeListOptions', node, start, end)
  assertTextFontsLoaded('setRangeListOptions', node)
  updateParagraphs(graph, node, start, end, (style) => withListType(style, options.type))
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

/** What Figma reports about an indentation it rejects, or `null`. */
function indentationProblem(level: number): string | null {
  if (!Number.isInteger(level)) return 'Expected integer, received float'
  if (level < 0) return 'Number must be greater than or equal to 0'
  if (level > MAX_LIST_INDENTATION)
    return `Number must be less than or equal to ${MAX_LIST_INDENTATION}`
  return null
}

export function setRangeIndentation(
  graph: SceneGraph,
  node: SceneNode,
  start: number,
  end: number,
  level: number
): void {
  const invalid = indentationProblem(level)
  if (invalid) {
    throw new Error(`in setRangeIndentation: Property "indentation" failed validation: ${invalid}`)
  }
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

/** What Figma reports about a spacing it rejects, or `null`. */
export function spacingProblem(value: number): string | null {
  return value >= 0 ? null : 'Number must be greater than or equal to 0'
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
  const invalid = spacingProblem(value)
  if (invalid) throw new Error(`in ${method}: Property "value" failed validation: ${invalid}`)
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
