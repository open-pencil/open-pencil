import { defineRule } from '#core/lint/rule'
const MIN_SIZE = 44
const PATTERNS = [
  /button/i,
  /btn/i,
  /link/i,
  /cta/i,
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
function isInteractive(name: string): boolean {
  return PATTERNS.some((pattern) => pattern.test(name))
}

export default defineRule({
  meta: {
    id: 'touch-target-size',
    category: 'accessibility',
    description: `Interactive elements should be at least ${MIN_SIZE}×${MIN_SIZE}px`
  },
  match: ['FRAME', 'COMPONENT', 'INSTANCE', 'RECTANGLE', 'ELLIPSE'],
  check(node, context) {
    if (!isInteractive(node.name)) return
    if (node.width >= MIN_SIZE && node.height >= MIN_SIZE) return
    // A control nested in another control (the icon of a button) is not its own target.
    for (let parent = context.getParent(node); parent; parent = context.getParent(parent)) {
      if (isInteractive(parent.name)) return
    }
    context.report({
      node,
      message: `Touch target too small: ${node.width}×${node.height}px`,
      suggest: `Resize to at least ${MIN_SIZE}×${MIN_SIZE}px or add padding`,
      data: { width: node.width, height: node.height, minSize: MIN_SIZE }
    })
  }
})
