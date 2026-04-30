import { defineRule } from '#core/lint/rule'

export default defineRule({
  meta: {
    id: 'no-hardcoded-colors',
    category: 'design-tokens',
    description: 'Colors should use variables instead of hardcoded values'
  },
  match: [
    'RECTANGLE',
    'ELLIPSE',
    'FRAME',
    'TEXT',
    'VECTOR',
    'LINE',
    'POLYGON',
    'STAR',
    'COMPONENT',
    'INSTANCE'
  ],
  check(node, context) {
    const checkPaints = (paints: typeof node.fills, field: 'fills' | 'strokes') => {
      for (const paint of paints) {
        if (paint.type !== 'SOLID' || !paint.visible || !paint.color || node.boundVariables[field])
          continue
        context.report({
          node,
          message: `Hardcoded ${field === 'fills' ? 'fill' : 'stroke'} color detected`,
          suggest: 'Bind this color to a design variable for consistency'
        })
      }
    }
    checkPaints(node.fills, 'fills')
    checkPaints(node.strokes as typeof node.fills, 'strokes')
  }
})
