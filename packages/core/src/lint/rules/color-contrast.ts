import { colorToHex, contrastRatio } from '@open-pencil/scene-graph/color'
import { rotatedBBox } from '@open-pencil/scene-graph/geometry'

import { defineRule } from '#core/lint/rule'
import type { LintNode, RuleContext } from '#core/lint/types'

/** WCAG AA: 4.5:1 for text, 3:1 for large text, which is 24px, or 18.66px when bold. */
const MIN_CONTRAST = 4.5
const MIN_LARGE_CONTRAST = 3
const LARGE_TEXT_PX = 24
const LARGE_BOLD_TEXT_PX = 18.66
const BOLD_WEIGHT = 700

function overlapsTextBounds(node: LintNode, sibling: LintNode): boolean {
  const text = rotatedBBox(node.x, node.y, node.width, node.height, node.rotation)
  const background = rotatedBBox(
    sibling.x,
    sibling.y,
    sibling.width,
    sibling.height,
    sibling.rotation
  )
  return (
    text.left < background.right &&
    text.right > background.left &&
    text.top < background.bottom &&
    text.bottom > background.top
  )
}

/** Whether a filled sibling behind the text overlaps its bounds. */
function hasOverlappingSiblingFill(node: LintNode, context: RuleContext): boolean {
  const parent = context.getParent(node)
  if (!parent) return false
  const siblings = context.getChildren(parent)
  const nodeIndex = siblings.findIndex((sibling) => sibling.id === node.id)
  if (nodeIndex <= 0) return false

  for (let index = 0; index < nodeIndex; index++) {
    const sibling = siblings[index]
    if (
      sibling.type === 'TEXT' ||
      !sibling.visible ||
      sibling.opacity === 0 ||
      !sibling.fills.some((fill) => fill.visible && fill.opacity > 0 && (fill.color?.a ?? 1) > 0)
    )
      continue
    if (!overlapsTextBounds(node, sibling)) continue
    return true
  }
  return false
}

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

export default defineRule({
  meta: {
    id: 'color-contrast',
    category: 'accessibility',
    severity: 'error',
    description: 'Text must have sufficient contrast against its background'
  },
  match: ['TEXT'],
  check(node, context) {
    const textColor = node.fills.find((f) => f.type === 'SOLID' && f.visible && f.color)?.color
    if (textColor == null) return
    let parent = context.getParent(node)
    // A painted sibling may replace the ancestor fill under this text; avoid a guessed ratio.
    if (hasOverlappingSiblingFill(node, context)) return
    while (parent) {
      const background = parent.fills.find((f) => f.type === 'SOLID' && f.visible && f.color)?.color
      if (background) {
        const ratio = contrastRatio(textColor, background)
        const minRatio = requiredContrast(node)
        if (ratio < minRatio)
          context.report({
            node,
            message: `Contrast ratio ${ratio.toFixed(2)}:1 is below WCAG AA`,
            suggest: 'Increase contrast between text and background',
            data: {
              ratio: Math.floor(ratio * 100) / 100,
              minRatio,
              foreground: colorToHex({ ...textColor, a: 1 }),
              background: colorToHex({ ...background, a: 1 })
            }
          })
        return
      }
      parent = context.getParent(parent)
    }
  }
})
