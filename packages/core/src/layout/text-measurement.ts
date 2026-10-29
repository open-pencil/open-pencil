import type { SceneNode } from '@open-pencil/scene-graph'
import { weightToStyle } from '@open-pencil/scene-graph/font-style'
import { lineHeightPixels } from '@open-pencil/scene-graph/text'

import { measureTextWithFont } from '#core/text/font/glyphs'

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
  const style = weightToStyle(node.fontWeight || 400, node.italic)
  const text = node.text || ''

  const ownLineH = lineHeightPixels(node.lineHeight, fontSize) ?? 0
  const explicitLineH = ownLineH > 0 ? ownLineH : undefined
  const measured = measureTextWithFont(text, fontSize, family, style, maxWidth, explicitLineH)
  if (measured) return measured

  const charWidth = fontSize * GLYPH_WIDTH_FACTOR
  const singleLineWidth = Math.ceil(text.length * charWidth)
  const lineH = explicitLineH ?? Math.ceil(fontSize * 1.4)

  if (maxWidth && maxWidth > 0 && singleLineWidth > maxWidth) {
    const lines = Math.ceil(singleLineWidth / maxWidth)
    return { width: maxWidth, height: Math.ceil(lines * lineH) }
  }
  return { width: singleLineWidth, height: lineH }
}

export function getTextMeasurer(): TextMeasurer | null {
  return globalTextMeasurer
}

export function setTextMeasurer(measurer: TextMeasurer | null): void {
  globalTextMeasurer = measurer
}

/** The size of `node`'s text: measured when a measurer is installed and can, estimated otherwise. */
export function measureTextForLayout(
  node: SceneNode,
  maxWidth?: number
): { width: number; height: number } {
  return globalTextMeasurer?.(node, maxWidth) ?? estimateTextSize(node, maxWidth)
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
