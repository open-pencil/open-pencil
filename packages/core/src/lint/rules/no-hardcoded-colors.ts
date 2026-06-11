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
    const checkPaints = (
      paints: ReadonlyArray<{
        visible: boolean
        color?: { r: number; g: number; b: number }
        type?: string
      }>,
      field: 'fills' | 'strokes'
    ) => {
      for (let i = 0; i < paints.length; i++) {
        const paint = paints[i]
        if (paint.type !== 'SOLID' || !paint.visible || !paint.color) continue
        // Check indexed binding (e.g. "fills/0/color") — the format the renderer actually reads
        if (node.boundVariables[`${field}/${i}/color`]) continue
        context.report({
          node,
          message: `Hardcoded ${field === 'fills' ? 'fill' : 'stroke'} color detected`,
          suggest: 'Bind this color to a design variable for consistency'
        })
      }
    }
    checkPaints(node.fills, 'fills')
    checkPaints(node.strokes, 'strokes')
  }
})
