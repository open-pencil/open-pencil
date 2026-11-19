import { noop } from 'es-toolkit'
import { inject, type InjectionKey } from 'vue'

/** Closes the toolbar menu a choice sits in. */
export const CLOSE_TOOLBAR_MENU: InjectionKey<() => void> = Symbol('close toolbar menu')

/**
 * Closes the enclosing toolbar menu once a choice in it is made, as FigJam's menus do; outside a
 * menu, such as in a panel, it does nothing.
 */
export function useCloseToolbarMenu(): () => void {
  return inject(CLOSE_TOOLBAR_MENU, noop)
}
