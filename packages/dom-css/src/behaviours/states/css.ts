import type {
  DesignDocument,
  DesignElement,
  DesignNode,
  DesignStyleDeclaration
} from '#dom-css/types'
import { compact } from 'es-toolkit/array'

import type { StateCondition, StateElement, StateNode, StateStyles } from './model'
import { layerClassNames, propAttribute } from './names'

export interface StateStylesheet {
  /** The merged markup, each layer carrying its class and no inline style. */
  document: DesignDocument
  css: string
}

const quoted = (value: string) => JSON.stringify(value)

/** The selector part a condition adds to the control's root. */
export function conditionSelector(condition: StateCondition): string {
  if (condition.type === 'state') return `[data-state=${quoted(condition.value)}]`
  if (condition.type === 'disabled') return '[data-disabled]'
  if (condition.type === 'prop')
    return `[${propAttribute(condition.name)}=${quoted(condition.value)}]`
  if (condition.state === 'focus') return ':focus-visible'
  // A disabled control keeps its disabled look under the pointer.
  return `${condition.state === 'hover' ? ':hover' : ':active'}:not([data-disabled])`
}

function declarations(style: DesignStyleDeclaration): string {
  return Object.entries(style)
    .map(([property, value]) => `  ${property}: ${value};`)
    .join('\n')
}

function designNode(node: StateNode, classes: Map<StateElement, string>): DesignNode {
  if (node.type === 'text') return node
  const className = compact([node.attrs.class, classes.get(node)]).join(' ')
  const element: DesignElement = {
    type: 'element',
    tagName: node.tagName,
    attrs: { ...node.attrs, class: className },
    children: node.children.map((child) => designNode(child, classes))
  }
  return element
}

/**
 * The state styles as a stylesheet with a readable class per layer. A rule with more
 * conditions has a more specific selector, so a combined variant wins over each of its parts.
 */
export function stateStylesToCSS(styles: StateStyles): StateStylesheet {
  const classes = layerClassNames(styles)
  const rootClass = classes.get(styles.root) ?? ''
  const blocks: { order: number; text: string }[] = []
  for (const [element, className] of classes) {
    const own = element === styles.root ? '' : ` .${className}`
    if (Object.keys(element.base).length > 0)
      blocks.push({ order: 0, text: `.${rootClass}${own} {\n${declarations(element.base)}\n}` })
    for (const rule of element.rules) {
      const when = rule.conditions.map(conditionSelector).join('')
      blocks.push({
        order: rule.conditions.length,
        text: `.${rootClass}${when}${own} {\n${declarations(rule.style)}\n}`
      })
    }
  }
  const css = blocks
    .sort((a, b) => a.order - b.order)
    .map((block) => block.text)
    .join('\n\n')
  return { document: { type: 'document', children: [designNode(styles.root, classes)] }, css }
}
