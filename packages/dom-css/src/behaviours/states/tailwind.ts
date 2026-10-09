import { splitWhitespace } from '#dom-css/export/html'
import type { DesignDocument, DesignNode, DesignStyleDeclaration } from '#dom-css/types'
import { twirl } from 'twirlwind'

import { cssName, propAttribute } from './names'
import type { StateCondition, StateElement, StateNode, StateStyles } from './types'

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
  if (condition.type === 'filled') return on('has-[:is(input,textarea):not(:placeholder-shown)]')
  if (condition.type === 'prop') {
    const attribute = propAttribute(condition.name).slice('data-'.length)
    return on(`data-[${attribute}=${variantValue(condition.value)}]`)
  }
  if (condition.state === 'focus') return on(condition.within ? 'focus-within' : 'focus-visible')
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

/** What each element's utilities are written against. */
interface Groups {
  /** The control's root group. */
  root: string
  /** A named group for each layer other than the root whose state a rule tests. */
  anchors: Map<StateElement, string>
}

/** The group a rule's conditions test from `node`, or null when they test `node` itself. */
function testedGroup(
  node: StateElement,
  on: StateElement | undefined,
  groups: Groups,
  isRoot: boolean
): string | null {
  if (on) return on === node ? null : (groups.anchors.get(on) ?? null)
  return isRoot ? null : groups.root
}

function designNode(
  node: StateNode,
  groups: Groups,
  isRoot: boolean,
  options: StateTailwindOptions
): DesignNode {
  if (node.type === 'text') return node
  const anchor = groups.anchors.get(node)
  const classes = [
    ...(node.attrs.class ? splitWhitespace(node.attrs.class) : []),
    ...(isRoot ? [`group/${groups.root}`] : []),
    ...(anchor ? [`group/${anchor}`] : []),
    ...utilities(node.base, options),
    ...node.rules.flatMap((rule) => {
      const group = testedGroup(node, rule.on, groups, isRoot)
      const prefix = [
        ...rule.conditions.map((condition) => variant(condition, group)),
        ...(rule.pseudo
          ? [rule.pseudo === 'placeholder' ? 'placeholder:' : `[&::${rule.pseudo}]:`]
          : [])
      ].join('')
      return utilities(rule.style, options).map((utility) => `${prefix}${utility}`)
    })
  ]
  return {
    type: 'element',
    tagName: node.tagName,
    attrs: { ...node.attrs, class: classes.join(' ') },
    children: node.children.map((child) => designNode(child, groups, false, options))
  }
}

/** The layers rules test other than the root, each named after the root's group. */
function anchorGroups(root: StateElement, group: string): Map<StateElement, string> {
  const anchors = new Map<StateElement, string>()
  const visit = (node: StateNode) => {
    if (node.type === 'text') return
    for (const rule of node.rules)
      if (rule.on && !anchors.has(rule.on)) anchors.set(rule.on, `${group}-${anchors.size + 1}`)
    for (const child of node.children) visit(child)
  }
  visit(root)
  return anchors
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
  const root = cssName(styles.name, 'component')
  const groups = { root, anchors: anchorGroups(styles.root, root) }
  return { type: 'document', children: [designNode(styles.root, groups, true, options)] }
}
