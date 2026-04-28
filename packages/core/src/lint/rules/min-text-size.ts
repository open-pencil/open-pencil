import { defineRule } from '#core/lint/rule'

export default defineRule({
  meta: {
    id: 'min-text-size',
    category: 'accessibility',
    description: 'Text should be large enough to be readable (minimum 12px)'
  },
  match: ['TEXT'],
  check(node, context) {
    const config = context.getConfig() as { minSize?: number } | undefined
    const minSize = config?.minSize ?? 12
    if (node.fontSize < minSize)
      context.report({
        node,
        message: `Text size ${node.fontSize}px is below minimum ${minSize}px`,
        suggest: `Increase to at least ${minSize}px for readability`
      })
  }
})
