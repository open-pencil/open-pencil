import { splitWhitespace } from '#dom-css/export/html'
import type { DesignDocument, DesignNode, DesignStyleDeclaration } from '#dom-css/types'
import { twirl } from 'twirlwind'

import { cssName, propAttribute } from './names'
import type { StateCondition, StateNode, StateStyles } from './types'

export interface StateTailwindOptions {
  /** Custom properties declared in `@theme`; a `var()` naming one becomes its utility. */
  themeVariables?: readonly string[]
}

/** A value inside a variant: bare when it is a plain word, else quoted with spaces as `_`. */
const variantValue = (value: string) =>
  /^[\w-]+$/.test(value) ? value : `"${value.replace(/\s/g, '_').replace(/"/g, '\\"')}"`

/**
 * The variant a condition adds. On the root it tests the root itself; below it, it tests the
 * root through its named group, so a control nested in another reacts only to its own root.
 */
function variant(condition: StateCondition, group: string | null): string {
  const on = (name: string) => (group ? `group-${name}/${group}:` : `${name}:`)
  if (condition.type === 'state') return on(`data-[state=${variantValue(condition.value)}]`)
  if (condition.type === 'disabled') return on('data-disabled')
  if (condition.type === 'prop') {
    const attribute = propAttribute(condition.name).slice('data-'.length)
    return on(`data-[${attribute}=${variantValue(condition.value)}]`)
  }
  if (condition.state === 'focus') return on('focus-visible')
  // A disabled control keeps its disabled look under the pointer.
  const enabled = group ? `group-not-data-disabled/${group}:` : 'not-data-disabled:'
  return `${enabled}${on(condition.state === 'hover' ? 'hover' : 'active')}`
}

function utilities(style: DesignStyleDeclaration, options: StateTailwindOptions): string[] {
  const css = Object.entries(style)
    .map(([property, value]) => `${property}: ${value}`)
    .join('; ')
  return css
    ? splitWhitespace(twirl(css, { theme: { variables: options.themeVariables ?? [] } }))
    : []
}

function designNode(
  node: StateNode,
  group: string,
  isRoot: boolean,
  options: StateTailwindOptions
): DesignNode {
  if (node.type === 'text') return node
  const classes = [
    ...(node.attrs.class ? splitWhitespace(node.attrs.class) : []),
    ...(isRoot ? [`group/${group}`] : []),
    ...utilities(node.base, options),
    ...node.rules.flatMap((rule) => {
      const prefix = rule.conditions
        .map((condition) => variant(condition, isRoot ? null : group))
        .join('')
      return utilities(rule.style, options).map((utility) => `${prefix}${utility}`)
    })
  ]
  return {
    type: 'element',
    tagName: node.tagName,
    attrs: { ...node.attrs, class: classes.join(' ') },
    children: node.children.map((child) => designNode(child, group, false, options))
  }
}

/**
 * The state styles as Tailwind utilities on each element: rest utilities, and each variant's
 * changes behind the variants that show it. More stacked variants make a more specific
 * selector, so a combined variant wins over each of its parts.
 */
export function stateStylesToTailwind(
  styles: StateStyles,
  options: StateTailwindOptions = {}
): DesignDocument {
  const group = cssName(styles.name, 'component')
  return { type: 'document', children: [designNode(styles.root, group, true, options)] }
}
