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

function isPluralControlWord(word: string): boolean {
  return word.endsWith('s') && CONTROL_WORDS.has(word.slice(0, -1))
}

function isInteractive(name: string): boolean {
  return nameWords(name).some((word) => CONTROL_WORDS.has(word) || isPluralControlWord(word))
}

function isPluralOnlyControlGroup(name: string, childCount: number): boolean {
  if (childCount < 2) return false
  const words = nameWords(name)
  return words.some(isPluralControlWord) && !words.some((word) => CONTROL_WORDS.has(word))
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
    // A row of controls named in the plural is not one target; its controls are.
    if (!isInteractive(node.name) || isPluralOnlyControlGroup(node.name, node.childIds.length))
      return
    const config = context.getConfig() as { minSize?: number } | undefined
    const minSize = config?.minSize ?? DEFAULT_MIN_SIZE
    if (node.width >= minSize && node.height >= minSize) return
    // A control nested in another control (the icon of a button) is not its own target.
    for (let ancestor = context.getParent(node); ancestor; ancestor = context.getParent(ancestor)) {
      if (
        isInteractive(ancestor.name) &&
        !isPluralOnlyControlGroup(ancestor.name, ancestor.childIds.length)
      ) {
        return
      }
    }
    context.report({
      node,
      message: `Touch target too small: ${node.width}×${node.height}px`,
      suggest: `Resize to at least ${minSize}×${minSize}px or add padding`,
      data: { width: node.width, height: node.height, minSize }
    })
  }
})
