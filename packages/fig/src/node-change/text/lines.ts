import type { TextLineData } from '@open-pencil/kiwi/fig/codec'
import {
  paragraphStyleAt,
  textListItems,
  textParagraphRanges,
  trimParagraphStyles,
  type SceneNode,
  type TextListType,
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

/** The paragraph styles a `.fig` text stores in `textData.lines`, one line per paragraph. */
export function importParagraphStyles(
  lines: readonly TextLineData[] | undefined
): TextParagraphStyle[] {
  if (!lines) return []
  const styles = lines.map((line) => ({
    listType: listTypeOf(line),
    indentation: line.indentationLevel ?? 0
  }))
  return trimParagraphStyles(styles, styles.length)
}

/**
 * `textData.lines` for a text: one per paragraph, marking list items, how deeply they nest,
 * and which item starts each list, as Figma writes them.
 */
export function exportTextLines(node: Pick<SceneNode, 'text' | 'textParagraphs'>): TextLineData[] {
  const starts = new Set(
    textListItems(node.text, node.textParagraphs)
      .filter((item) => item.startsList)
      .map((item) => item.paragraph)
  )
  return textParagraphRanges(node.text).map((_, paragraph) => {
    const style = paragraphStyleAt(node.textParagraphs, paragraph)
    return {
      lineType: LINE_TYPES[style.listType],
      styleId: 0,
      indentationLevel: style.indentation,
      sourceDirectionality: 'AUTO',
      listStartOffset: 0,
      isFirstLineOfList: starts.has(paragraph)
    }
  })
}
