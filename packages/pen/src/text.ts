import type { SceneNode, TextAlignVertical, TextAutoResize } from '@open-pencil/scene-graph'
import { percentLength, pixelLength } from '@open-pencil/scene-graph/text'

import type { PenNode } from './schema'
import { bindIfVar, isVarRef, resolveNumber, resolveString, type VarContext } from './variables'

const FONT_WEIGHTS: Partial<Record<string, number>> = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900
}

/** pen.dev writes weights as numbers in strings, such as "700"; older files use names. */
function fontWeight(value: PenNode['fontWeight'], ctx: VarContext): number {
  if (value === undefined) return 400
  if (typeof value === 'number') return value
  const named = isVarRef(value) ? ctx.resolveString(value) || ctx.resolveNumber(value) : value
  const numeric = Number(named)
  if (Number.isFinite(numeric) && numeric > 0) return numeric
  return FONT_WEIGHTS[String(named).toLowerCase()] ?? 400
}

const TEXT_ALIGN: Partial<Record<string, SceneNode['textAlignHorizontal']>> = {
  left: 'LEFT',
  center: 'CENTER',
  right: 'RIGHT',
  justify: 'JUSTIFIED'
}

const TEXT_ALIGN_VERTICAL: Partial<Record<string, TextAlignVertical>> = {
  top: 'TOP',
  middle: 'CENTER',
  bottom: 'BOTTOM'
}

/**
 * `auto` grows on one line, `fixed-width` wraps and grows down, and `fixed-width-height` wraps in
 * a fixed box its text may overflow.
 */
const TEXT_GROWTH: Partial<Record<string, TextAutoResize>> = {
  auto: 'WIDTH_AND_HEIGHT',
  'fixed-width': 'HEIGHT',
  'fixed-width-height': 'NONE'
}

/**
 * A text layer's content and style. Content that reads like a variable reference stays as written,
 * as pen.dev shows it. pen.dev 2.21 draws no underline, strikethrough, or text stroke, so those
 * are left out to match it.
 */
export function applyTextProps(node: SceneNode, pen: PenNode, ctx: VarContext): void {
  const isIconFont = pen.type === 'icon_font'
  node.text = isIconFont ? (pen.iconFontName ?? '') : (pen.content ?? '')
  node.fontFamily = isIconFont
    ? (pen.iconFontFamily ?? 'Material Symbols Sharp')
    : (resolveString(pen.fontFamily, ctx) ?? 'Inter')
  bindIfVar(node, 'fontFamily', pen.fontFamily, ctx)
  node.fontSize = resolveNumber(pen.fontSize, ctx, 14)
  bindIfVar(node, 'fontSize', pen.fontSize, ctx)
  node.fontWeight = fontWeight(pen.fontWeight ?? (isIconFont ? pen.weight : undefined), ctx)
  node.italic = resolveString(pen.fontStyle, ctx)?.toLowerCase() === 'italic'
  node.textAlignHorizontal = TEXT_ALIGN[pen.textAlign ?? 'left'] ?? 'LEFT'
  node.textAlignVertical = TEXT_ALIGN_VERTICAL[pen.textAlignVertical ?? 'top'] ?? 'TOP'
  // pen.dev's line height multiplies the font size, so it follows the size as a percent.
  if (pen.lineHeight !== undefined) {
    node.lineHeight = percentLength(resolveNumber(pen.lineHeight, ctx) * 100)
  }
  if (pen.letterSpacing !== undefined) {
    node.letterSpacing = pixelLength(resolveNumber(pen.letterSpacing, ctx))
  }
  node.textAutoResize = TEXT_GROWTH[pen.textGrowth ?? 'auto'] ?? 'WIDTH_AND_HEIGHT'
  // pen.dev draws every font at its default optical size, whatever the text's size.
  node.opticalSizeFromFontSize = false
  node.strokes = []
}
