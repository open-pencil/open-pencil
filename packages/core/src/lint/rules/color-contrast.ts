import { colorToHex, compositeOver, contrastRatio } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { defineRule } from '#core/lint/rule'
import type { LintNode, RuleContext } from '#core/lint/types'

/** WCAG AA: 4.5:1 for text, 3:1 for large text, which is 24px, or 18.66px when bold. */
const MIN_CONTRAST = 4.5
const MIN_LARGE_CONTRAST = 3
const LARGE_TEXT_PX = 24
const LARGE_BOLD_TEXT_PX = 18.66
const BOLD_WEIGHT = 700

function minContrast(style: { fontSize: number; fontWeight: number }): number {
  const large =
    style.fontSize >= LARGE_TEXT_PX ||
    (style.fontSize >= LARGE_BOLD_TEXT_PX && style.fontWeight >= BOLD_WEIGHT)
  return large ? MIN_LARGE_CONTRAST : MIN_CONTRAST
}

/** The strictest threshold any stretch of the text needs. */
function requiredContrast(node: {
  fontSize: number
  textStyles?: { fontSize: number; fontWeight: number }[]
}): number {
  const styles = node.textStyles ?? [{ fontSize: node.fontSize, fontWeight: 0 }]
  return Math.max(...styles.map(minContrast))
}

type SolidPaint = LintNode['fills'][number] & {
  color: NonNullable<LintNode['fills'][number]['color']>
}

function isSolidPaint(fill: LintNode['fills'][number]): fill is SolidPaint {
  return fill.type === 'SOLID' && fill.visible && fill.color != null
}

function opaque(color: Pick<Color, 'r' | 'g' | 'b'>): Color {
  return { ...color, a: 1 }
}

/**
 * What the text sits on: the fills of its ancestors in paint order, translucent solid ones
 * composited over the nearest opaque one, which may sit under them on the same ancestor.
 * Undefined when no ancestor has an opaque fill, since what shows through a translucent fill
 * then is not part of the design, or when a gradient or image shows above it, since those are
 * not composited yet.
 */
function backdrop(node: LintNode, context: RuleContext): Color | undefined {
  const layers: SolidPaint[] = []
  for (let parent = context.getParent(node); parent; parent = context.getParent(parent)) {
    // Fills paint in array order, so the last one is on top.
    for (const paint of parent.fills.toReversed()) {
      if (!paint.visible || paint.opacity <= 0) continue
      if (paint.type !== 'SOLID') return undefined
      if (!isSolidPaint(paint)) continue
      if (paint.opacity >= 1) {
        return layers.reduceRight(
          (bg, layer) => compositeOver(opaque(layer.color), bg, layer.opacity),
          opaque(paint.color)
        )
      }
      layers.push(paint)
    }
  }
  return undefined
}

export default defineRule({
  meta: {
    id: 'color-contrast',
    category: 'accessibility',
    severity: 'error',
    description: 'Text must have sufficient contrast against its background'
  },
  match: ['TEXT'],
  check(node, context) {
    // Paints under the topmost opaque solid fill are covered by it.
    const base = node.fills.findLastIndex((paint) => isSolidPaint(paint) && paint.opacity >= 1)
    const visible = node.fills.slice(Math.max(base, 0))
    // Gradients and images are not composited yet, so a stack showing one has no single color.
    if (visible.some((paint) => paint.visible && paint.type !== 'SOLID' && paint.opacity > 0))
      return
    const text = visible.filter(isSolidPaint)
    if (!text.some((paint) => paint.opacity > 0)) return
    const bg = backdrop(node, context)
    if (!bg) return
    const fg = text.reduce(
      (color, paint) => compositeOver(opaque(paint.color), color, paint.opacity),
      bg
    )
    const ratio = contrastRatio(fg, bg)
    const minRatio = requiredContrast(node)
    if (ratio < minRatio)
      context.report({
        node,
        message: `Contrast ratio ${ratio.toFixed(2)}:1 is below WCAG AA`,
        suggest: 'Increase contrast between text and background',
        data: {
          ratio: Math.floor(ratio * 100) / 100,
          minRatio,
          foreground: colorToHex(fg),
          background: colorToHex(bg)
        }
      })
  }
})
