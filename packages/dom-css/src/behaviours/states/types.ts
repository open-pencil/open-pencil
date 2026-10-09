import type { DesignStyleDeclaration, DesignText } from '#dom-css/types'

/**
 * What must hold on a control's root for a variant to show. Reka and Radix set `data-state`
 * and `data-disabled` themselves; the browser sets the interactions; a generated component
 * sets `data-*` from its props for every other variant property.
 */
export type StateCondition =
  | { type: 'state'; value: string }
  | { type: 'disabled' }
  /** `within` when focus lands on a layer inside the control, such as a field's input. */
  | { type: 'interaction'; state: 'hover' | 'pressed' | 'focus'; within?: boolean }
  /** A field whose input holds text. */
  | { type: 'filled' }
  | { type: 'prop'; name: string; value: string }

/** What a variant changes on a layer, and the conditions that show that variant. */
export interface StateRule {
  conditions: StateCondition[]
  /**
   * The layer the conditions test when it is not the control's root, such as a tab trigger
   * that Reka and Radix mark active itself: the layer the rule styles, or one around it.
   */
  on?: StateElement
  /** The part of the layer the rule styles: an input's placeholder, or a number input's spinner. */
  pseudo?: 'placeholder' | '-webkit-inner-spin-button'
  style: DesignStyleDeclaration
}

/** A layer of the merged markup: its rest style and what each other variant changes. */
export interface StateElement {
  type: 'element'
  /** The layer path below the variant, with the text when variants label a layer differently. */
  key: string
  /** What the layer draws other than its own box, such as an instance or an icon (`layerKind`). */
  kind: string | undefined
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
  /** The variant drawing the rest state, which the merged tree starts from. */
  restId: string
  root: StateElement
}
