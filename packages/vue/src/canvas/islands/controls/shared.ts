import type { VNode } from 'vue'

import type { ControlModel, ControlRole, DesignElement } from '@open-pencil/dom-css/export'

import type { ElementOverride, IslandRenderContext } from '#vue/canvas/islands/render'
import { isDisabled, type ControlState } from '#vue/canvas/islands/state'

/** What a role's wrapper gets: the island, the layer, and how to render it as designed. */
export interface RoleContext<R extends ControlRole = ControlRole> {
  island: IslandRenderContext
  role: R
  element: DesignElement
  base: (override?: ElementOverride) => VNode
}

export function stateOf(island: IslandRenderContext, control: ControlModel): ControlState {
  const state = island.state.get(control.path)
  if (!state) throw new Error(`No state for control ${control.path}`)
  return state
}

export function disabled(island: IslandRenderContext, control: ControlModel): boolean {
  return isDisabled(control, island.state.get(control.path))
}

/**
 * Pointer and focus handlers that drive a control's interaction states. Focus shows from the
 * keyboard, as `:focus-visible` does, or always when `focusOnPress`, as on a text field.
 */
export function interaction(state: ControlState, focusOnPress = false): Record<string, unknown> {
  return {
    onPointerenter: () => (state.hovered = true),
    onPointerleave: () => {
      state.hovered = false
      state.pressed = false
    },
    onPointerdown: () => (state.pressed = true),
    onPointerup: () => (state.pressed = false),
    onFocusin: (event: FocusEvent) => {
      const target = event.target instanceof Element ? event.target : null
      state.focused = focusOnPress || !!target?.matches(':focus-visible')
    },
    onFocusout: () => (state.focused = false)
  }
}

/** Turn a group's items on and off so that only the chosen one is on. */
export function chooseItem(island: IslandRenderContext, group: ControlModel, choice: string): void {
  stateOf(island, group).choice = choice
  for (const [index, item] of group.items.entries()) {
    const valueId = item.kind === 'collapsible' ? 'open' : 'value'
    stateOf(island, item).booleans[valueId] = String(index) === choice
  }
}
