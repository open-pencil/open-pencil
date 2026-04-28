import { defineRule } from '#core/lint/rule'
const PATTERNS = [
  /button/i,
  /btn/i,
  /link/i,
  /cta/i,
  /icon/i,
  /checkbox/i,
  /radio/i,
  /switch/i,
  /toggle/i,
  /input/i,
  /select/i,
  /dropdown/i,
  /menu/i,
  /tab/i,
  /chip/i,
  /tag/i,
  /close/i,
  /dismiss/i,
  /action/i
]
export default defineRule({
  meta: {
    id: 'touch-target-size',
    category: 'accessibility',
    description: 'Interactive elements should be at least 44x44px'
  },
  match: ['FRAME', 'COMPONENT', 'INSTANCE', 'RECTANGLE', 'ELLIPSE'],
  check(node, context) {
    if (!PATTERNS.some((p) => p.test(node.name))) return
    if (node.width >= 44 && node.height >= 44) return
    context.report({
      node,
      message: `Touch target too small: ${node.width}×${node.height}px`,
      suggest: 'Resize to at least 44×44px or add padding'
    })
  }
})
