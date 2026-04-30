import { defineRule } from '#core/lint/rule'

export default defineRule({
  meta: {
    id: 'no-deeply-nested',
    category: 'structure',
    description: 'Avoid deeply nested layers'
  },
  check(node, context) {
    const config = context.getConfig() as { maxDepth?: number } | undefined
    const maxDepth = config?.maxDepth ?? 6
    let depth = 0
    let current = context.getParent(node)
    while (current) {
      depth++
      current = context.getParent(current)
    }
    if (depth > maxDepth) {
      context.report({
        node,
        message: `Layer nested ${depth} levels deep (max ${maxDepth})`,
        suggest: 'Flatten structure or extract a component'
      })
    }
  }
})
