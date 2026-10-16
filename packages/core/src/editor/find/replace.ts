import { paragraphStylesAfterEdit } from '@open-pencil/scene-graph'
import type { SceneNode, StyleRun, TextParagraphStyle } from '@open-pencil/scene-graph'

import {
  adjustRunsForDelete,
  adjustRunsForInsert,
  applyStyleToRange,
  getStyleAt
} from '#core/text/style-runs'

import type { TextRange } from './search'

export interface TextReplacement {
  text: string
  styleRuns: StyleRun[]
  textParagraphs: TextParagraphStyle[]
}

/**
 * The text, character styles, and paragraph styles of a layer after `ranges` become
 * `replacement`. The new text takes the style of the first character it replaces, so a bold
 * word stays bold, and styles elsewhere keep their characters. Ranges are applied from the
 * end so the earlier ones stay valid. Returns null when nothing changes.
 */
export function replaceRanges(
  node: Pick<SceneNode, 'text' | 'styleRuns' | 'textParagraphs'>,
  ranges: readonly TextRange[],
  replacement: string
): TextReplacement | null {
  let { text, styleRuns, textParagraphs } = node
  for (const { start, end } of ranges.toSorted((a, b) => b.start - a.start)) {
    const inherited = getStyleAt(styleRuns, start)
    textParagraphs = paragraphStylesAfterEdit(textParagraphs, text, start, end, replacement)
    styleRuns = adjustRunsForInsert(
      adjustRunsForDelete(styleRuns, start, end - start),
      start,
      replacement.length
    )
    text = text.slice(0, start) + replacement + text.slice(end)
    if (replacement.length > 0 && Object.keys(inherited).length > 0) {
      styleRuns = applyStyleToRange(
        styleRuns,
        start,
        start + replacement.length,
        inherited,
        text.length
      )
    }
  }
  return text === node.text ? null : { text, styleRuns, textParagraphs }
}
