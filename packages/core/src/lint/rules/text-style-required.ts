import { defineRule } from '#core/lint/rule'

export default defineRule({
  meta: {
    id: 'text-style-required',
    category: 'typography',
    description: 'Text layers should use shared typography tokens or styles'
  },
  match: ['TEXT'],
  check(node, context) {
    if (node.text.length <= 2) return
    // A shared text style is already the shared typography this rule asks for.
    if (context.isSharedStyle('text', node.textStyleId)) return
    if (node.boundVariables.fontSize || node.boundVariables.fontFamily) return
    // Suggesting a binding is only actionable when the document has typography values to bind.
    const { FLOAT, STRING } = context.variables.counts
    if (FLOAT === 0 && STRING === 0) return
    context.report({
      node,
      message: 'Text layer without typography variable bindings',
      suggest: 'Bind font size or font family to a shared text token when possible'
    })
  }
})
