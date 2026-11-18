import { unrefElement, type MaybeElementRef } from '@vueuse/core'
import { computed, shallowRef } from 'vue'

/**
 * Keeps a picker from jumping when its tabs change its height, as Figma's does. It opens centred
 * on its swatch; from the first press inside it, its top stays that far from the swatch, so the
 * tab row stays under the pointer, and it moves only to stay in the window.
 */
export function useSteadyPlacement(swatch: MaybeElementRef) {
  /** The picker's top less the swatch's, held from the first press until it closes. */
  const held = shallowRef<number | null>(null)

  /** For the picker's `pointerdown`, in capture phase, before the press changes its height. */
  function hold(event: PointerEvent) {
    if (held.value !== null || !(event.currentTarget instanceof HTMLElement)) return
    const trigger = unrefElement(swatch)
    // The popper positions this wrapper; the content inside it may be scaling in.
    const placed = event.currentTarget.closest('[data-reka-popper-content-wrapper]')
    if (!trigger || !placed) return
    held.value = placed.getBoundingClientRect().top - trigger.getBoundingClientRect().top
  }

  function release() {
    held.value = null
  }

  /** The box the picker is placed against: the swatch, moved to where the picker's top is held. */
  const reference = computed(() => {
    const offset = held.value
    if (offset === null) return undefined
    return {
      getBoundingClientRect() {
        const trigger = unrefElement(swatch)?.getBoundingClientRect() ?? new DOMRect()
        return new DOMRect(trigger.left, trigger.top + offset, trigger.width, 0)
      }
    }
  })
  const align = computed(() => (held.value === null ? 'center' : 'start'))

  return { hold, release, reference, align }
}
