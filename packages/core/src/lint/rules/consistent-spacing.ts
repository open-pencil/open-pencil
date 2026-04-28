import { defineRule } from '#core/lint/rule'
import { isMultipleOf, SPACING_SCALE } from '#core/lint/utils'

export default defineRule({
  meta: {
    id: 'consistent-spacing',
    category: 'layout',
    description: 'Spacing should follow the spacing scale'
  },
  match: ['FRAME', 'COMPONENT'],
  check(node, context) {
    if (node.layoutMode === 'NONE') return
    const config = context.getConfig() as { base?: number } | undefined
    const base = config?.base ?? 8
    const valid = (value: number) => SPACING_SCALE.includes(value) || isMultipleOf(value, base)
    const values = [
      ['gap', node.itemSpacing],
      ['paddingTop', node.paddingTop],
      ['paddingRight', node.paddingRight],
      ['paddingBottom', node.paddingBottom],
      ['paddingLeft', node.paddingLeft]
    ] as const
    for (const [name, value] of values) {
      if (value > 0 && !valid(value)) {
        context.report({
          node,
          message: `${name} ${value}px is not in spacing scale`,
          suggest: 'Use a spacing token or 8pt-grid multiple'
        })
      }
    }
  }
})
