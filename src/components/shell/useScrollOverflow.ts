import { useResizeObserver, useScroll } from '@vueuse/core'
import { computed, ref, type ShallowRef } from 'vue'

import { animationsEnabled } from '@/app/shell/motion'

/**
 * Tracks which ends of a horizontally scrolling row hide content, for an edge fade and a chevron
 * that scrolls toward the hidden side. The row's first child is watched as well as the row, so
 * content that changes width without resizing the row (another language, a renamed tab) is
 * remeasured.
 */
export function useScrollOverflow(scroller: Readonly<ShallowRef<HTMLElement | null>>) {
  const { arrivedState, measure } = useScroll(scroller)
  /** Whether the row is wider than its box, from sizes alone, so scrolling never changes it. */
  const overflowing = ref(false)
  function remeasure() {
    measure()
    const element = scroller.value
    overflowing.value = !!element && element.scrollWidth > element.clientWidth
  }
  useResizeObserver(scroller, remeasure)
  useResizeObserver(() => {
    const content = scroller.value?.firstElementChild
    return content instanceof HTMLElement ? content : null
  }, remeasure)

  const overflowStart = computed(() => !arrivedState.left)
  const overflowEnd = computed(() => !arrivedState.right)

  /** Scroll a page toward the hidden end, or back to the start once the end is reached. */
  function scrollTowardHidden() {
    const element = scroller.value
    if (!element) return
    element.scrollBy({
      left: overflowEnd.value ? element.clientWidth : -element.scrollWidth,
      behavior: animationsEnabled.value ? 'smooth' : 'auto'
    })
  }

  return { overflowing, overflowStart, overflowEnd, scrollTowardHidden }
}
