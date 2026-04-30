import { defineRule } from '#core/lint/rule'
export default defineRule({
  meta: {
    id: 'no-groups',
    category: 'structure',
    description: 'Use frames instead of groups for better layout control'
  },
  match: ['GROUP'],
  check(node, context) {
    context.report({
      node,
      message: 'Group should be converted to Frame',
      suggest: 'Groups cannot use auto layout. Convert to Frame for better control.'
    })
  }
})
