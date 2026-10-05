import { defineRule } from '#core/lint/rule'
import { inComponentTree } from '#core/lint/utils'

export default defineRule({
  meta: {
    id: 'no-hidden-layers',
    category: 'structure',
    description: 'Hidden layers may indicate unused elements'
  },
  check(node, context) {
    if (node.visible) return
    context.report({
      node,
      message: 'Hidden layer detected',
      suggest: 'Delete if unused or keep only if required for component states',
      ...(node.locked || inComponentTree(node) ? {} : { suggestions: [{ kind: 'delete' }] })
    })
  }
})
