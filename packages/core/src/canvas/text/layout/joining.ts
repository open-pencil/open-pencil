import { resolveNodeTextDirection } from '@open-pencil/scene-graph/text/direction'

import type { BlockBuild, JoinedBlock } from '#core/canvas/text/layout/block'
import { UNSPACED_LINES, type LineFitting } from '#core/canvas/text/layout/fit'
import {
  isUnspaced,
  lineSpacing,
  spacesLetters,
  type LineSpacing
} from '#core/canvas/text/layout/letter-spacing'
import {
  buildTruncateOpts,
  paragraphTextAlign,
  resolveParagraphLayoutWidth
} from '#core/canvas/text/paragraph'
import type { ParagraphNode } from '#core/canvas/text/paragraph/inputs'
import { lineEndJoiners, type Joiner } from '#core/canvas/text/paragraph/joiners'
import { DEFAULT_FONT_SIZE } from '#core/constants'
import { shownSourceIndices, shownText, textCaseSegments } from '#core/text/case'

const TYPICAL_ADVANCE_EMS = 0.5

// Skia lays joiners out as style blocks, so a paragraph gets them only once its lines move apart.
export function firstBuild(
  node: ParagraphNode,
  spacing: LineSpacing,
  joiners: readonly Joiner[],
  plain: () => JoinedBlock,
  join: (maxLines?: number) => JoinedBlock
): BlockBuild {
  if (joiners.length === 0) {
    return plain()
  }
  if (likelyWraps(node, spacing, joiners)) {
    return join()
  }
  const built: BlockBuild = plain()
  built.join = join
  return built
}

export function likelyWraps(
  node: ParagraphNode,
  spacing: LineSpacing,
  joiners: readonly Joiner[]
): boolean {
  const width = resolveParagraphLayoutWidth(node)
  const advance = (node.fontSize || DEFAULT_FONT_SIZE) * TYPICAL_ADVANCE_EMS + spacing.most
  return joiners.some((joiner, index) => {
    const paragraphStart = index > 0 ? joiners[index - 1].tailEnd : 0
    return (joiner.at - paragraphStart) * advance > width
  })
}

export function textJoiners(
  node: ParagraphNode,
  fitting: LineFitting,
  start: number,
  end: number
): Joiner[] {
  const alignsEnds = fitting.align === 'Center' || fitting.align === 'Right'
  if (!alignsEnds || fitting.rtl || isUnspaced(fitting.spacing)) {
    return []
  }
  if (shownText(node).length !== node.text.length) {
    return []
  }
  return lineEndJoiners(node.text.slice(start, end), (index) =>
    fitting.spacing.after(start + index)
  )
}

export function lineFitting(node: ParagraphNode): LineFitting {
  const fontSize = node.fontSize || DEFAULT_FONT_SIZE
  if (!spacesLetters(node.letterSpacing, fontSize, node.styleRuns)) {
    return UNSPACED_LINES
  }
  const spacing = lineSpacing({
    text: shownText(node),
    letterSpacing: node.letterSpacing,
    fontSize,
    styleRuns: node.styleRuns,
    sourceLength: node.text.length,
    sourceIndex: shownToSourceIndex(node)
  })
  return {
    spacing,
    align: paragraphTextAlign(node),
    rtl: resolveNodeTextDirection(node) === 'RTL',
    truncatesWithEllipsis: buildTruncateOpts(node).ellipsis !== undefined
  }
}

export function shownToSourceIndex(node: ParagraphNode): (shownIndex: number) => number {
  let lookup: ((shownIndex: number) => number) | undefined
  return (shownIndex) => {
    lookup ??= sourceIndexLookup(node)
    return lookup(shownIndex)
  }
}

function sourceIndexLookup(node: ParagraphNode): (shownIndex: number) => number {
  if (textCaseSegments(node).every((segment) => segment.textCase === 'ORIGINAL')) {
    return (shownIndex) => Math.min(shownIndex, node.text.length)
  }
  const indices = shownSourceIndices(node)
  return (shownIndex) => indices[shownIndex] ?? node.text.length
}
