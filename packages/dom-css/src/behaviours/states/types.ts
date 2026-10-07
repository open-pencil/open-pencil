import type { DesignStyleDeclaration, DesignText } from '#dom-css/types'

/**
 * What must hold on a control's root for a variant to show. Reka and Radix set `data-state`
 * and `data-disabled` themselves; the browser sets the interactions; a generated component
 * sets `data-*` from its props for every other variant property.
 */
export type StateCondition =
  | { type: 'state'; value: string }
  | { type: 'disabled' }
  | { type: 'interaction'; state: 'hover' | 'pressed' | 'focus' }
  | { type: 'prop'; name: string; value: string }

/** What a variant changes on a layer, and the conditions that show that variant. */
export interface StateRule {
  conditions: StateCondition[]
  style: DesignStyleDeclaration
}

/** A layer of the merged markup: its rest style and what each other variant changes. */
export interface StateElement {
  type: 'element'
  /** The layer path below the variant, with the text when variants label a layer differently. */
  key: string
  /** The layer's name, for class names. */
  name: string
  tagName: string
  attrs: Record<string, string>
  base: DesignStyleDeclaration
  rules: StateRule[]
  children: StateNode[]
}

export type StateNode = StateElement | DesignText

export interface StateStyles {
  /** The set's name, for the root's class name. */
  name: string
  root: StateElement
}
