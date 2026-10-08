import { colorToHex, contrastRatio } from '@open-pencil/scene-graph/color'

import { defineRule } from '#core/lint/rule'

const MIN_CONTRAST = 4.5

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
    while (parent) {
      const bg = parent.fills.find((f) => f.type === 'SOLID' && f.visible && f.color)?.color
      if (bg) {
        const ratio = contrastRatio(textColor, bg)
        if (ratio < MIN_CONTRAST)
          context.report({
            node,
            message: `Contrast ratio ${ratio.toFixed(2)}:1 is below WCAG AA`,
            suggest: 'Increase contrast between text and background',
            data: {
              ratio: Math.floor(ratio * 100) / 100,
              minRatio: MIN_CONTRAST,
              foreground: colorToHex({ ...textColor, a: 1 }),
              background: colorToHex({ ...bg, a: 1 })
            }
          })
        return
      }
      parent = context.getParent(parent)
    }
  }
})
