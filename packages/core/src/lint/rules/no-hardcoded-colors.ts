import { colorToHex } from '@open-pencil/scene-graph/color'

import { defineRule } from '#core/lint/rule'

export default defineRule({
  meta: {
    id: 'no-hardcoded-colors',
    category: 'design-tokens',
    description: 'Colors that match a color variable should be bound to it'
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
    const { colorsByHex } = context.variables
    if (colorsByHex.size === 0) return
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
        // Only a color with an exact variable match has an obvious fix: bind that variable.
        const color = colorToHex({ ...paint.color, a: 1 })
        const variable = colorsByHex.get(color)
        if (!variable) continue
        context.report({
          node,
          message: `Hardcoded ${field === 'fills' ? 'fill' : 'stroke'} color ${color} matches variable "${variable.name}"`,
          suggest: `Bind ${field === 'fills' ? 'fill' : 'stroke'} to "${variable.name}"`,
          data: {
            paint: field === 'fills' ? 'fill' : 'stroke',
            index: i,
            color,
            variableId: variable.id,
            variableName: variable.name
          },
          fix: {
            kind: 'bind-variable',
            path: `${field}/${i}/color`,
            variableId: variable.id,
            variableName: variable.name
          }
        })
      }
    }
    checkPaints(node.fills, 'fills')
    checkPaints(node.strokes, 'strokes')
  }
})
