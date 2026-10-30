import { useBreakpoints, useMediaQuery } from '@vueuse/core'
import { computed } from 'vue'

const breakpoints = useBreakpoints({ mobile: 768 })

/**
 * Returns coarse viewport kind flags used by responsive editor UI. `isMobile` is a narrow
 * viewport, which changes the layout; `isTouch` is a finger for a pointer, which alone calls for
 * touch-sized controls, so a narrow desktop window keeps mouse-sized ones.
 */
export function useViewportKind() {
  const isMobile = breakpoints.smaller('mobile')
  const isDesktop = computed(() => !isMobile.value)
  const isTouch = useMediaQuery('(pointer: coarse)')

  return {
    isMobile,
    isDesktop,
    isTouch
  }
}
