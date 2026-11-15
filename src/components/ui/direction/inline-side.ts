import { useDirection } from 'reka-ui'
import { computed } from 'vue'

/**
 * The physical side, for a popover's `side`, at the start or end of the line in the interface's
 * direction. A popover opening from the properties panel toward the canvas opens at the start:
 * left in a left-to-right interface, right in a mirrored one.
 */
export function useInlineSide(edge: 'start' | 'end') {
  const direction = useDirection()
  return computed<'left' | 'right'>(() =>
    (edge === 'start') === (direction.value === 'rtl') ? 'right' : 'left'
  )
}
