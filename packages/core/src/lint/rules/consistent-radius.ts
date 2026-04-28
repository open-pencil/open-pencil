import { defineRule } from '#core/lint/rule'
const SCALE = [0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 9999]
export default defineRule({
  meta: {
    id: 'consistent-radius',
    category: 'layout',
    description: 'Corner radius should follow the radius scale'
  },
  match: ['RECTANGLE', 'FRAME', 'COMPONENT', 'INSTANCE'],
  check(node, context) {
    if (node.cornerRadius > 0 && !SCALE.includes(node.cornerRadius))
      context.report({
        node,
        message: `Corner radius ${node.cornerRadius}px is not in scale`,
        suggest: 'Use a radius token or a scale value'
      })
  }
})
