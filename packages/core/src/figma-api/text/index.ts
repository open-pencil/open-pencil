import { upperFirst } from 'es-toolkit/string'

import {
  MAX_LIST_INDENTATION,
  paragraphIndexAt,
  paragraphStyleAt,
  paragraphStylesAfterEdit,
  paragraphStylesInRange,
  recordInstanceOverride,
  sharedParagraphSpacing,
  textParagraphRanges,
  trimParagraphStyles,
  withIndentation,
  withListType,
  withParagraphSpacing
} from '@open-pencil/scene-graph'
import type {
  SceneGraph,
  SceneNode,
  TextParagraphSpacingField,
  TextParagraphStyle
} from '@open-pencil/scene-graph'

import { assertTextRange } from './style'

/** Figma's plugin API line height: automatic, or a size in pixels or percent of the font size. */
export type FigmaLineHeight = { unit: 'AUTO' } | { unit: 'PIXELS' | 'PERCENT'; value: number }
/** Figma's plugin API letter spacing, in pixels or percent of the font size. */
export interface FigmaLetterSpacing {
  unit: 'PIXELS' | 'PERCENT'
  value: number
}

/** The node keeps sizes in pixels; a percent is of its font size when set, as Figma resolves it. */
function pixels(value: { unit: 'PIXELS' | 'PERCENT'; value: number }, fontSize: number) {
  return value.unit === 'PERCENT' ? (value.value / 100) * fontSize : value.value
}

/**
 * Accepts Figma's object, or a bare number of pixels or `null` for automatic, as earlier
 * OpenPencil scripts wrote it.
 */
export function lineHeightValue(
  node: SceneNode,
  value: FigmaLineHeight | number | null
): number | null {
  if (value === null || typeof value === 'number') return value
  return value.unit === 'AUTO' ? null : pixels(value, node.fontSize)
}

/** Accepts Figma's object, or a bare number of pixels as earlier OpenPencil scripts wrote it. */
export function letterSpacingValue(node: SceneNode, value: FigmaLetterSpacing | number): number {
  return typeof value === 'number' ? value : pixels(value, node.fontSize)
}

export function insertCharacters(
  graph: SceneGraph,
  node: SceneNode,
  start: number,
  characters: string
): void {
  const text = node.text.slice(0, start) + characters + node.text.slice(start)
  const textParagraphs = paragraphStylesAfterEdit(
    node.textParagraphs,
    node.text,
    start,
    start,
    characters
  )
  graph.updateNode(node.id, { text, textParagraphs })
  recordInstanceOverride(graph, node.id, ['text', 'textParagraphs'])
}

export function deleteCharacters(
  graph: SceneGraph,
  node: SceneNode,
  start: number,
  end: number
): void {
  const text = node.text.slice(0, start) + node.text.slice(end)
  const textParagraphs = paragraphStylesAfterEdit(node.textParagraphs, node.text, start, end, '')
  graph.updateNode(node.id, { text, textParagraphs })
  recordInstanceOverride(graph, node.id, ['text', 'textParagraphs'])
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
