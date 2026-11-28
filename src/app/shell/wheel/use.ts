import { useEventListener } from '@vueuse/core'

import { startsHistorySwipe } from './history-swipe'
import type { HorizontalScroller } from './history-swipe'
import { useShellPinchGestures } from './pinch'

function* scrollersUnder(event: WheelEvent): Generator<HorizontalScroller> {
  for (const target of event.composedPath()) {
    if (!(target instanceof Element) || target.scrollWidth <= target.clientWidth) continue
    const style = getComputedStyle(target)
    yield {
      scrollLeft: target.scrollLeft,
      scrollWidth: target.scrollWidth,
      clientWidth: target.clientWidth,
      overflowX: style.overflowX,
      direction: style.direction
    }
  }
}

/**
 * Keeps the editor's wheel gestures in the editor: Ctrl or Cmd with the wheel zooms the
 * canvas rather than the page, a sideways trackpad swipe never goes back or forward in the
 * browser's history, and a Linux desktop touchpad pinch zooms the canvas, not the whole page.
 */
export function useEditorWheelGuard(): void {
  useShellPinchGestures()
  useEventListener(
    document,
    'wheel',
    (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        startsHistorySwipe(event, () => scrollersUnder(event))
      ) {
        event.preventDefault()
      }
    },
    { passive: false }
  )
}
