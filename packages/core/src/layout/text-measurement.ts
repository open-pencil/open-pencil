import type { SceneNode } from '@open-pencil/scene-graph'
import { faceStyleKey } from '@open-pencil/scene-graph/font-style'
import { lineStepPixels, paragraphSpacingAt } from '@open-pencil/scene-graph/text'

import { rangeCapHeight } from '#core/text/character-face'
import { measureTextWithFont, type MeasuredTextLines } from '#core/text/font/glyphs'

export type TextMeasurer = (
  node: SceneNode,
  maxWidth?: number
) => { width: number; height: number } | null

let globalTextMeasurer: TextMeasurer | null = null

const GLYPH_WIDTH_FACTOR = 0.6

export function estimateTextSize(
  node: SceneNode,
  maxWidth?: number
): { width: number; height: number } {
  const fontSize = node.fontSize || 14
  const family = node.fontFamily || 'Inter'
  const style = faceStyleKey({ ...node, fontWeight: node.fontWeight || 400 })
  const text = node.text || ''

  const ownLineH = lineStepPixels(node.lineHeight, fontSize) ?? 0
  const explicitLineH = ownLineH > 0 ? ownLineH : undefined
  const hardLines = text.split('\n')
  const measured = hardLines.map(
    (line) =>
      measureTextWithFont(line, fontSize, family, style, maxWidth, explicitLineH) ??
      estimateTextLines(line, fontSize, maxWidth, explicitLineH)
  )
  const { width, lines, paragraphSpacing } = stackParagraphs(node, measured)
  const { lineHeight } = measured[0]
  if (node.leadingTrim === 'CAP_HEIGHT') {
    const firstLineCapHeight = rangeCapHeight(node, 0, hardLines[0].length)
    // To the nearest pixel, as Figma sizes a trimmed text and live layout does.
    const trimmed = firstLineCapHeight + (lines - 1) * lineHeight + paragraphSpacing
    return { width, height: Math.round(trimmed) }
  }
  return { width, height: untrimmedHeight(lines, lineHeight) + paragraphSpacing }
}

function shownLineLimit(node: SceneNode): number {
  if (node.textTruncation === 'ENDING' && node.maxLines != null && node.maxLines > 0) {
    return node.maxLines
  }
  return Number.POSITIVE_INFINITY
}

function stackParagraphs(node: SceneNode, paragraphs: MeasuredTextLines[]) {
  const limit = shownLineLimit(node)
  let width = 0
  let lines = 0
  let paragraphSpacing = 0
  for (const [index, paragraph] of paragraphs.entries()) {
    if (lines >= limit) {
      break
    }
    if (index > 0) {
      paragraphSpacing += paragraphSpacingAt(node, index - 1, 'paragraphSpacing')
    }
    width = Math.max(width, paragraph.width)
    lines += Math.min(paragraph.lines, limit - lines)
  }
  return { width, lines, paragraphSpacing }
}

function estimateTextLines(
  text: string,
  fontSize: number,
  maxWidth: number | undefined,
  explicitLineH: number | undefined
): MeasuredTextLines {
  const charWidth = fontSize * GLYPH_WIDTH_FACTOR
  const singleLineWidth = Math.ceil(text.length * charWidth)
  const lineHeight = explicitLineH ?? Math.ceil(fontSize * 1.4)

  if (maxWidth && maxWidth > 0 && singleLineWidth > maxWidth) {
    const lines = Math.ceil(singleLineWidth / maxWidth)
    return { width: maxWidth, lines, lineHeight }
  }
  return { width: singleLineWidth, lines: 1, lineHeight }
}

function untrimmedHeight(lines: number, lineHeight: number): number {
  if (lines === 1) {
    return lineHeight
  }
  return Math.ceil(lines * lineHeight)
}

export function autoWidthWrapWidth(
  node: Pick<SceneNode, 'minWidth' | 'maxWidth'>
): number | undefined {
  if (node.maxWidth == null) {
    return undefined
  }
  return Math.max(node.maxWidth, node.minWidth ?? 0)
}

export function getTextMeasurer(): TextMeasurer | null {
  return globalTextMeasurer
}

export function setTextMeasurer(measurer: TextMeasurer | null): void {
  globalTextMeasurer = measurer
}

/**
 * The size of `node`'s text. With a measurer installed, that is its size in its own fonts; text
 * whose fonts are not prepared keeps the size it has, never one guessed in another face, until
 * the measurer's host prepares them and lays it out again (the editor's `createPendingTextLayout`).
 * With none, as in a host without fonts, it is estimated.
 */
export function measureTextForLayout(
  node: SceneNode,
  maxWidth?: number
): { width: number; height: number } {
  if (!globalTextMeasurer) return estimateTextSize(node, maxWidth)
  const measured = globalTextMeasurer(node, maxWidth)
  if (measured) return measured
  // Empty text measures nothing but its line, which needs no fonts beyond the default.
  if (node.type !== 'TEXT' || !node.text) return estimateTextSize(node, maxWidth)
  return { width: node.width, height: node.height }
}

const installedMeasurers: TextMeasurer[] = []

/**
 * Makes `measurer` the layout text measurer until the returned function uninstalls it. Then
 * the most recent measurer still installed takes over, so closing one editor neither leaves
 * layout measuring with its destroyed renderer nor keeps that editor alive.
 */
export function installTextMeasurer(measurer: TextMeasurer): () => void {
  installedMeasurers.push(measurer)
  globalTextMeasurer = measurer
  return () => {
    const index = installedMeasurers.lastIndexOf(measurer)
    if (index !== -1) installedMeasurers.splice(index, 1)
    if (globalTextMeasurer === measurer) globalTextMeasurer = installedMeasurers.at(-1) ?? null
  }
}

/**
 * Run `fn` with `measurer` as the layout text measurer. The measurer is shared, so `fn` must
 * be synchronous: an override held across an await would leak into other layouts.
 */
export function withTextMeasurer<T>(measurer: TextMeasurer, fn: () => T): T {
  const previous = globalTextMeasurer
  globalTextMeasurer = measurer
  try {
    return fn()
  } finally {
    globalTextMeasurer = previous
  }
}
