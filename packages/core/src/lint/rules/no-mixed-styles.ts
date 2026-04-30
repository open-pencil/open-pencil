import { defineRule } from '#core/lint/rule'

export default defineRule({
  meta: {
    id: 'no-mixed-styles',
    category: 'typography',
    description: 'Text layers should not mix multiple styles in one node'
  },
  match: ['TEXT'],
  check(node, context) {
    if (node.text.length > 1 && node.styleRunCount > 0) {
      context.report({
        node,
        message: 'Text layer has mixed font styles',
        suggest: 'Split into separate text layers or unify the text style'
      })
    }
  }
})
