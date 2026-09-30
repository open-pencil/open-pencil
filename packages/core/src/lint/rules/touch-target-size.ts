import { defineRule } from '#core/lint/rule'
import { nameWords } from '#core/lint/utils'

/** WCAG 2.2 target size, enhanced (AAA). `minSize: 24` checks the AA minimum instead. */
const DEFAULT_MIN_SIZE = 44
/** Words that name a control; a trailing plural `s` also matches ("Tabs", "Actions"). */
const CONTROL_WORDS = new Set([
  'button',
  'btn',
  'link',
  'cta',
  'checkbox',
  'radio',
  'switch',
  'toggle',
  'input',
  'select',
  'dropdown',
  'menu',
  'tab',
  'chip',
  'tag',
  'close',
  'dismiss',
  'action'
])

function isInteractive(name: string): boolean {
  return nameWords(name).some(
    (word) =>
      CONTROL_WORDS.has(word) || (word.endsWith('s') && CONTROL_WORDS.has(word.slice(0, -1)))
  )
}

export default defineRule({
  meta: {
    id: 'touch-target-size',
    category: 'accessibility',
    description:
      'Interactive elements should be large enough to tap (44×44px, or 24×24px for WCAG AA)'
  },
  match: ['FRAME', 'COMPONENT', 'INSTANCE', 'RECTANGLE', 'ELLIPSE'],
  check(node, context) {
    if (!isInteractive(node.name)) return
    const config = context.getConfig() as { minSize?: number } | undefined
    const minSize = config?.minSize ?? DEFAULT_MIN_SIZE
    if (node.width >= minSize && node.height >= minSize) return
    // A control nested in another control (the icon of a button) is not its own target.
    for (let parent = context.getParent(node); parent; parent = context.getParent(parent)) {
      if (isInteractive(parent.name)) return
    }
    context.report({
      node,
      message: `Touch target too small: ${node.width}×${node.height}px`,
      suggest: `Resize to at least ${minSize}×${minSize}px or add padding`,
      data: { width: node.width, height: node.height, minSize }
    })
  }
})
