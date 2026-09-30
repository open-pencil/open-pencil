import { defineRule } from '#core/lint/rule'
import { nearestValue } from '#core/lint/utils'

/** Radii from the scale; the pill radius is offered only for a layer that already reads as one. */
const SCALE = [0, 2, 4, 6, 8, 12, 16, 20, 24, 32]
const PILL_RADIUS = 9999

export default defineRule({
  meta: {
    id: 'consistent-radius',
    category: 'layout',
    description: 'Corner radius should follow the radius scale'
  },
  match: ['RECTANGLE', 'FRAME', 'COMPONENT', 'INSTANCE'],
  check(node, context) {
    const radius = node.cornerRadius
    if (radius <= 0 || radius === PILL_RADIUS || SCALE.includes(radius)) return
    const pill = radius >= Math.min(node.width, node.height) / 2
    const suggested = pill ? PILL_RADIUS : nearestValue(radius, SCALE.slice(1))
    context.report({
      node,
      message: `Corner radius ${radius}px is not in scale`,
      suggest: 'Use a radius token or a scale value',
      data: { radius },
      suggestions:
        suggested === null ? undefined : [{ kind: 'set', changes: { cornerRadius: suggested } }]
    })
  }
})
