import { defineRule } from '#core/lint/rule'
import { contrastRatio } from '#core/lint/utils'

export default defineRule({
  meta: {
    id: 'color-contrast',
    category: 'accessibility',
    severity: 'error',
    description: 'Text must have sufficient contrast against its background'
  },
  match: ['TEXT'],
  check(node, context) {
    const textFill = node.fills.find((f) => f.type === 'SOLID' && f.visible && f.color)
    const textColor = textFill?.color
    if (!textColor) return
    let parent = context.getParent(node)
    while (parent) {
      const bg = parent.fills.find((f) => f.type === 'SOLID' && f.visible && f.color)?.color
      if (bg) {
        const ratio = contrastRatio(textColor, bg)
        if (ratio < 4.5)
          context.report({
            node,
            message: `Contrast ratio ${ratio.toFixed(2)}:1 is below WCAG AA`,
            suggest: 'Increase contrast between text and background'
          })
        return
      }
      parent = context.getParent(parent)
    }
  }
})
