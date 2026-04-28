import { defineRule } from '#core/lint/rule'
import { isDefaultName } from '#core/lint/utils'

export default defineRule({
  meta: {
    id: 'no-default-names',
    category: 'naming',
    description: 'Layers should have descriptive names'
  },
  check(node, context) {
    if (!isDefaultName(node.name)) return
    const isSmallDecorative =
      ['RECTANGLE', 'ELLIPSE', 'LINE'].includes(node.type) && node.width < 24 && node.height < 24
    if (isSmallDecorative) return
    context.report({
      node,
      message: `Default layer name "${node.name}" is not descriptive`,
      suggest: 'Rename to describe the layer purpose'
    })
  }
})
