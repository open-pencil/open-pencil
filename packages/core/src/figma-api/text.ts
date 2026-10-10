import {
  MAX_LIST_INDENTATION,
  paragraphIndexAt,
  paragraphStyleAt,
  paragraphStylesAfterEdit,
  paragraphStylesInRange,
  recordInstanceOverride,
  textParagraphRanges,
  trimParagraphStyles,
  withIndentation,
  withListType
} from '@open-pencil/scene-graph'
import type { SceneGraph, SceneNode, TextParagraphStyle } from '@open-pencil/scene-graph'

import { styleNameToWeight, weightToStyleName, type FigmaFontName } from './fonts'

export function getFontName(node: SceneNode): FigmaFontName {
  return { family: node.fontFamily, style: weightToStyleName(node.fontWeight, node.italic) }
}

export function setFontName(graph: SceneGraph, nodeId: string, fontName: FigmaFontName): void {
  const { weight, italic } = styleNameToWeight(fontName.style)
  graph.updateNode(nodeId, {
    fontFamily: fontName.family,
    fontWeight: weight,
    italic
  })
  recordInstanceOverride(graph, nodeId, ['fontFamily', 'fontWeight'])
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

/** Figma's checks on a character range, with its messages. */
function assertTextRange(method: string, node: SceneNode, start: number, end: number): void {
  if (start < 0) {
    throw new Error(
      `in ${method}: Property "start" failed validation: Number must be greater than or equal to 0`
    )
  }
  if (end <= start) {
    throw new Error(`in ${method}: Empty range selected. 'end' must be greater than 'start'`)
  }
  if (start >= node.text.length || end > node.text.length) {
    throw new Error(
      `in ${method}: Range outside of available characters. 'start' must be less than ` +
        `node.characters.length and 'end' must be less than or equal to node.characters.length`
    )
  }
}

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
