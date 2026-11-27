import type { DesignElement } from '#dom-css/types'

/**
 * The attributes a page marks components with. An element with `component` becomes a main
 * component of that name; inside an element with `component-set` it is a variant, named by its
 * properties, such as `Size=Small, State=Hover`. In a component, `text`, `visible`, and `slot`
 * name the property that sets an element's text, shows it, or takes its content.
 *
 * `reka` names the Reka UI element an element is, as Design JSX writes it: a component marked
 * `Switch.Root` behaves as a switch, and a box inside it marked `Switch.Thumb` is its thumb.
 * `behaviour`, beside a root, binds the control's values to the component's properties by name,
 * as the `set_behaviour` tool takes them without the kind: `{"values":{"value":"State"}}`.
 */
export const COMPONENT_ATTRIBUTES = {
  set: 'data-op-component-set',
  component: 'data-op-component',
  text: 'data-op-text',
  visible: 'data-op-visible',
  slot: 'data-op-slot',
  reka: 'data-op-reka',
  behaviour: 'data-op-behaviour'
} as const

/** Whether a page marks the element, which then keeps a layer of its own. */
export function isMarked(element: DesignElement): boolean {
  return Object.values(COMPONENT_ATTRIBUTES).some((name) => Object.hasOwn(element.attrs, name))
}
