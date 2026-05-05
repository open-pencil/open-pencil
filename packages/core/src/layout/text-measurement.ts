import type { SceneNode } from '#core/scene-graph'
import { weightToStyle } from '#core/text/fonts'
import { measureTextWithOpenType } from '#core/text/opentype'

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

  const explicitLineH = (node.lineHeight ?? 0) > 0 ? (node.lineHeight as number) : undefined
  const measured = measureTextWithOpenType(text, fontSize, family, style, maxWidth, explicitLineH)
  if (measured) return measured

  const charWidth = fontSize * GLYPH_WIDTH_FACTOR
  const singleLineWidth = Math.ceil(text.length * charWidth)
  const lineH = (node.lineHeight ?? 0) > 0 ? (node.lineHeight as number) : Math.ceil(fontSize * 1.4)

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
