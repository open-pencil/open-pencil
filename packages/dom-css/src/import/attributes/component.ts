import type { DesignElement } from '#dom-css/types'

/**
 * The attributes a page marks components with. An element with `component` becomes a main
 * component of that name; inside an element with `component-set` it is a variant, named by its
 * properties, such as `Size=Small, State=Hover`. In a component, `text`, `visible`, and `slot`
 * name the property that sets an element's text, shows it, or takes its content.
 *
 * Outside its component, an element marked `instance` with a component's or set's name is an
 * instance of it, of the variant whose properties `variant` names, such as `Checked=On`.
 */
export const COMPONENT_ATTRIBUTES = {
  set: 'data-op-component-set',
  component: 'data-op-component',
  text: 'data-op-text',
  visible: 'data-op-visible',
  slot: 'data-op-slot',
  instance: 'data-op-instance',
  variant: 'data-op-variant'
} as const

/** Whether a page marks the element, which then keeps a layer of its own. */
export function isMarked(element: DesignElement): boolean {
  return Object.values(COMPONENT_ATTRIBUTES).some((name) => Object.hasOwn(element.attrs, name))
}
