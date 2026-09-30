import { defineRule } from '#core/lint/rule'
import { nameWords } from '#core/lint/utils'

const MIN_SIZE = 44
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
