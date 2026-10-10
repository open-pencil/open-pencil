import type {
  DesignDocument,
  DesignElement,
  DesignNode,
  DesignStyleDeclaration
} from '#dom-css/types'
import cssesc from 'cssesc'
import { compact, sortBy } from 'es-toolkit/array'

import { layerClassNames, propAttribute } from './names'
import type { StateCondition, StateElement, StateNode, StateStyles } from './types'

export interface StateStylesheet {
  /** The merged markup, each layer carrying its class and no inline style. */
  document: DesignDocument
  css: string
}

/** A CSS string for an attribute selector's value. */
const quoted = (value: string) => cssesc(value, { quotes: 'double', wrap: true })

/** A field whose input or textarea shows text rather than its placeholder. */
export const FILLED = ':has(:is(input, textarea):not(:placeholder-shown))'

/** The selector part a condition adds to the control's root. */
export function conditionSelector(condition: StateCondition): string {
  if (condition.type === 'state') return `[data-state=${quoted(condition.value)}]`
  if (condition.type === 'disabled') return '[data-disabled]'
  if (condition.type === 'filled') return FILLED
  if (condition.type === 'prop')
    return `[${propAttribute(condition.name)}=${quoted(condition.value)}]`
  if (condition.state === 'focus') return condition.within ? ':focus-within' : ':focus-visible'
  // A disabled control keeps its disabled look under the pointer.
  return `${condition.state === 'hover' ? ':hover' : ':active'}:not([data-disabled])`
}

function designNode(node: StateNode, classes: Map<StateElement, string>): DesignNode {
  if (node.type === 'text') return node
  const className = compact([node.attrs.class, classes.get(node)]).join(' ')
  const element: DesignElement = {
    type: 'element',
    tagName: node.tagName,
    attrs: { ...node.attrs, class: className },
    children: node.children.map((child) => designNode(child, classes)),
    shader: node.shader
  }
  return element
}

/**
 * The state styles as a stylesheet with a readable class per layer. A rule with more
 * conditions comes later and has a more specific selector, so a combined variant wins over
 * each of its parts. The sheet is built with the CSS object model, which rejects an invalid
 * selector and prints the declarations.
 */
export async function stateStylesToCSS(styles: StateStyles): Promise<StateStylesheet> {
  const classes = layerClassNames(styles)
  const rootClass = classes.get(styles.root) ?? ''
  const rules: { order: number; selector: string; style: DesignStyleDeclaration }[] = []
  for (const [element, className] of classes) {
    const own = element === styles.root ? '' : ` .${className}`
    if (Object.keys(element.base).length > 0)
      rules.push({ order: 0, selector: `.${rootClass}${own}`, style: element.base })
    for (const rule of element.rules) {
      const when = rule.conditions.map(conditionSelector).join('')
      const on = rule.on && classes.get(rule.on)
      const pseudo = rule.pseudo ? `::${rule.pseudo}` : ''
      const tested = on
        ? ` .${on}${when}${rule.on === element ? '' : own}${pseudo}`
        : `${when}${own}${pseudo}`
      rules.push({
        order: rule.conditions.length,
        selector: `.${rootClass}${tested}`,
        style: rule.style
      })
    }
  }
  const sheet = await writableStyleSheet()
  for (const rule of sortBy(rules, [(item) => item.order])) {
    const index = sheet.insertRule(`${rule.selector} {}`)
    for (const [property, value] of Object.entries(rule.style))
      sheet.setProperty(index, property, value)
  }
  return {
    document: { type: 'document', children: [designNode(styles.root, classes)] },
    css: sheet.text()
  }
}

/** A stylesheet rules are inserted into and printed from. */
interface WritableStyleSheet {
  /** Parses `rule` at the end, throwing on an invalid selector, and returns its index. */
  insertRule(rule: string): number
  setProperty(index: number, property: string, value: string): void
  text(): string
}

/**
 * The browser's own CSS object model where there is one, and otherwise `@acemir/cssom`, loaded
 * only when a stylesheet is written. That package's browser build only defines a global and
 * exports nothing, so a browser bundle cannot use it.
 */
async function writableStyleSheet(): Promise<WritableStyleSheet> {
  if (typeof globalThis.CSSStyleSheet === 'function') {
    const sheet = new globalThis.CSSStyleSheet()
    return {
      insertRule: (rule) => sheet.insertRule(rule, sheet.cssRules.length),
      setProperty: (index, property, value) => {
        const rule = sheet.cssRules[index]
        if (rule instanceof CSSStyleRule) rule.style.setProperty(property, value)
      },
      text: () => Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n')
    }
  }
  const { CSSStyleSheet } = await import('@acemir/cssom')
  const sheet = new CSSStyleSheet()
  return {
    insertRule: (rule) => sheet.insertRule(rule, sheet.cssRules.length),
    setProperty: (index, property, value) =>
      sheet.cssRules[index]?.style.setProperty(property, value),
    text: () => sheet.toString()
  }
}
