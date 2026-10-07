import { claimName } from '#dom-css/export/storybook/names'
import { kebabCase } from 'es-toolkit/string'

import type { StateElement, StateStyles } from './types'

const NOT_NAME_PART = /[^a-z0-9-]/g

/** A CSS identifier made from a layer or set name, `fallback` when nothing of it is usable. */
export function cssName(text: string, fallback: string): string {
  const name = kebabCase(text).replace(NOT_NAME_PART, '')
  return /^[a-z]/.test(name) ? name : `${fallback}${name ? `-${name}` : ''}`
}

/**
 * A readable class per layer: the set's name for the root, `<root>__<layer>` below it,
 * numbered where two layers share a name.
 */
export function layerClassNames(styles: StateStyles): Map<StateElement, string> {
  const root = cssName(styles.name, 'component')
  const names = new Map<StateElement, string>([[styles.root, root]])
  const taken = new Set([root])
  const visit = (element: StateElement) => {
    for (const child of element.children) {
      if (child.type !== 'element') continue
      names.set(
        child,
        claimName(`${root}__${cssName(child.name, 'layer')}`, taken, { separator: '-' })
      )
      visit(child)
    }
  }
  visit(styles.root)
  return names
}

/** The attribute a generated component sets for a variant property it takes as a prop. */
export function propAttribute(name: string): string {
  return `data-${cssName(name, 'prop')}`
}
