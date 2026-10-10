import { isEmptyObject } from 'es-toolkit/predicate'

import type { NodeChange, TextLineData } from '@open-pencil/kiwi/fig/codec'
import {
  TEXT_PARAGRAPH_SPACING_FIELDS,
  paragraphStyleAt,
  textListItems,
  textParagraphRanges,
  trimParagraphStyles,
  withIndentation,
  withParagraphSpacing,
  type SceneNode,
  type TextListType,
  type TextParagraphSpacingField,
  type TextParagraphStyle
} from '@open-pencil/scene-graph'

const LINE_TYPES: Record<TextListType, NonNullable<TextLineData['lineType']>> = {
  NONE: 'PLAIN',
  ORDERED: 'ORDERED_LIST',
  UNORDERED: 'UNORDERED_LIST'
}

function listTypeOf(line: TextLineData): TextListType {
  if (line.lineType === 'ORDERED_LIST') return 'ORDERED'
  if (line.lineType === 'UNORDERED_LIST') return 'UNORDERED'
  return 'NONE'
}

/**
 * The paragraph styles a `.fig` text stores in `textData.lines`, one line per paragraph. A line's
 * `styleId` names an entry of the style override table that holds the paragraph's own spacing.
 */
export function importParagraphStyles(
  lines: readonly TextLineData[] | undefined,
  overrides: readonly NodeChange[] = []
): TextParagraphStyle[] {
  if (!lines) return []
  const byId = new Map(overrides.map((override) => [override.styleID, override]))
  const styles = lines.map((line) => {
    let style: TextParagraphStyle = {
      listType: listTypeOf(line),
      indentation: line.indentationLevel ?? 0
    }
    // A list item nests 1–5 deep; plain paragraphs keep the level the file stores.
    if (style.listType !== 'NONE') style = withIndentation(style, style.indentation)
    const override = line.styleId ? byId.get(line.styleId) : undefined
    for (const field of TEXT_PARAGRAPH_SPACING_FIELDS) {
      const value = override?.[field]
      if (value !== undefined) style = withParagraphSpacing(style, field, value)
    }
    return style
  })
  return trimParagraphStyles(styles, styles.length)
}

/**
 * `textData.lines` for a text: one per paragraph, marking list items, how deeply they nest,
 * and which item starts each list, as Figma writes them. Paragraphs with spacing of their own
 * name style override entries numbered from `firstStyleId`, returned in `overrides`.
 */
export function exportTextLines(
  node: Pick<SceneNode, 'text' | 'textParagraphs'>,
  firstStyleId = 1
): { lines: TextLineData[]; overrides: NodeChange[] } {
  const starts = new Set(
    textListItems(node.text, node.textParagraphs)
      .filter((item) => item.startsList)
      .map((item) => item.paragraph)
  )
  const overrides: NodeChange[] = []
  const ids = new Map<string, number>()
  const styleIdOf = (style: TextParagraphStyle): number => {
    const fields: Partial<Record<TextParagraphSpacingField, number>> = {}
    for (const field of TEXT_PARAGRAPH_SPACING_FIELDS) {
      const value = style[field]
      if (value !== undefined) fields[field] = value
    }
    if (isEmptyObject(fields)) return 0
    const key = JSON.stringify(fields)
    let id = ids.get(key)
    if (id === undefined) {
      id = firstStyleId + overrides.length
      ids.set(key, id)
      overrides.push({ styleID: id, ...fields })
    }
    return id
  }
  const lines = textParagraphRanges(node.text).map((_, paragraph): TextLineData => {
    const style = paragraphStyleAt(node.textParagraphs, paragraph)
    return {
      lineType: LINE_TYPES[style.listType],
      styleId: styleIdOf(style),
      indentationLevel: style.indentation,
      sourceDirectionality: 'AUTO',
      listStartOffset: 0,
      isFirstLineOfList: starts.has(paragraph)
    }
  })
  return { lines, overrides }
}
