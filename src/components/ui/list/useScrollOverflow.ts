import {
  useMutationObserver,
  usePreferredReducedMotion,
  useResizeObserver,
  useScroll
} from '@vueuse/core'
import { computed, ref, toValue, type MaybeRefOrGetter, type ShallowRef } from 'vue'

/** How close to an end counts as having reached it. */
const EDGE_TOLERANCE_PX = 8

/**
 * Tracks which ends of a horizontally scrolling row hide content, for an edge fade and a chevron
 * that scrolls toward the hidden side. The row's first child is watched as well as the row, and
 * its items are watched as they come and go, so content that changes width without resizing a
 * box (another language, a tab opened or closed while the row overflows) is remeasured. The
 * chevron scrolls smoothly unless `smooth` says not to, which by default follows the system's
 * reduced-motion setting.
 */
export function useScrollOverflow(
  scroller: Readonly<ShallowRef<HTMLElement | null>>,
  options: { smooth?: MaybeRefOrGetter<boolean> } = {}
) {
  const preferredMotion = usePreferredReducedMotion()
  const smooth = () => toValue(options.smooth) ?? preferredMotion.value !== 'reduce'
  // A row's own padding at either end is not hidden content.
  const { arrivedState, measure } = useScroll(scroller, {
    offset: { left: EDGE_TOLERANCE_PX, right: EDGE_TOLERANCE_PX }
  })
  /** Whether the row is wider than its box, from sizes alone, so scrolling never changes it. */
  const overflowing = ref(false)
  function remeasure() {
    measure()
    const element = scroller.value
    overflowing.value = !!element && element.scrollWidth > element.clientWidth
  }
  useResizeObserver(scroller, remeasure)
  const content = () => {
    const element = scroller.value?.firstElementChild
    return element instanceof HTMLElement ? element : null
  }
  useResizeObserver(content, remeasure)
  useMutationObserver(content, remeasure, { childList: true })

  const overflowStart = computed(() => !arrivedState.left)
  const overflowEnd = computed(() => !arrivedState.right)

  /** Scroll a page toward the hidden end, or back to the start once the end is reached. */
  function scrollTowardHidden() {
    const element = scroller.value
    if (!element) return
    element.scrollBy({
      left: overflowEnd.value ? element.clientWidth : -element.scrollWidth,
      behavior: smooth() ? 'smooth' : 'auto'
    })
  }

  return { overflowing, overflowStart, overflowEnd, scrollTowardHidden }
}
