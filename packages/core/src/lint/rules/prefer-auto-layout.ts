import { defineRule } from '#core/lint/rule'

export default defineRule({
  meta: {
    id: 'prefer-auto-layout',
    category: 'layout',
    description: 'Frames with multiple children should use auto layout'
  },
  match: ['FRAME', 'COMPONENT'],
  check(node, context) {
    const config = context.getConfig() as { minChildren?: number } | undefined
    const minChildren = config?.minChildren ?? 2
    if (node.layoutMode !== 'NONE' || context.getChildren(node).length < minChildren) return
    context.report({
      node,
      message: `Frame with ${context.getChildren(node).length} children doesn't use auto layout`,
      suggest: 'Add horizontal or vertical auto layout'
    })
  }
})
