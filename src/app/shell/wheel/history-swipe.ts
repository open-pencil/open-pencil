/** How far an element under the pointer can scroll sideways, from its layout and computed style. */
export interface HorizontalScroller {
  scrollLeft: number
  scrollWidth: number
  clientWidth: number
  overflowX: string
  direction: string
}

const USER_SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll'])

// Layout can leave a scroller a fraction of a pixel short of its edge.
const EDGE_TOLERANCE = 0.5

function canScrollToward(scroller: HorizontalScroller, deltaX: number): boolean {
  if (!USER_SCROLLABLE_OVERFLOW.has(scroller.overflowX)) return false
  const range = scroller.scrollWidth - scroller.clientWidth
  if (range <= EDGE_TOLERANCE) return false
  // A right-to-left scroller starts at 0 on its right edge and counts down to -range.
  const start = scroller.direction === 'rtl' ? -range : 0
  return deltaX < 0
    ? scroller.scrollLeft > start + EDGE_TOLERANCE
    : scroller.scrollLeft < start + range - EDGE_TOLERANCE
}

/**
 * Whether a wheel event would start the browser's back or forward swipe: it moves mostly
 * sideways and nothing under the pointer can scroll that way. Safari starts the swipe even
 * under `overscroll-behavior-x: none` and stops only for a prevented wheel event
 * (https://bugs.webkit.org/show_bug.cgi?id=240183).
 */
export function startsHistorySwipe(
  delta: { deltaX: number; deltaY: number },
  scrollers: () => Iterable<HorizontalScroller>
): boolean {
  if (Math.abs(delta.deltaX) <= Math.abs(delta.deltaY)) return false
  for (const scroller of scrollers()) {
    if (canScrollToward(scroller, delta.deltaX)) return false
  }
  return true
}
