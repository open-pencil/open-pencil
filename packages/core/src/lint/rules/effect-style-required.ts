import { defineRule } from '#core/lint/rule'

export default defineRule({
  meta: {
    id: 'effect-style-required',
    category: 'design-tokens',
    description: 'Effects should use shared effect presets or tokens'
  },
  check(node, context) {
    const visibleEffects = node.effects.filter((effect) => effect.visible)
    if (visibleEffects.length === 0) return
    context.report({
      node,
      message: `Effect without shared style: ${visibleEffects.map((effect) => `${effect.type} ${effect.radius}px`).join(', ')}`,
      suggest: 'Extract reusable shadows and blurs into shared presets or variables'
    })
  }
})
