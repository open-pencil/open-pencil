import { listen } from '@tauri-apps/api/event'
import { platform } from '@tauri-apps/plugin-os'
import { tryOnScopeDispose, useEventListener } from '@vueuse/core'

import { IS_TAURI } from '@/constants'

import type { HorizontalScroller } from './history-swipe'
import { startsHistorySwipe } from './history-swipe'

type PinchWheel = Pick<WheelEvent, 'clientX' | 'clientY' | 'deltaY'>

function useLinuxPinchWheel(): void {
  if (!IS_TAURI || platform() !== 'linux') return

  const subscription = listen<PinchWheel>('canvas-pinch-wheel', ({ payload }) => {
    // Hit-test like a wheel event so the canvas under the pointer (including its overlays)
    // handles the zoom, without sending pinches over a panel to the active canvas.
    document
      .elementFromPoint(payload.clientX, payload.clientY)
      ?.dispatchEvent(
        new WheelEvent('wheel', { ...payload, ctrlKey: true, bubbles: true, cancelable: true })
      )
  })
  tryOnScopeDispose(() => void subscription.then((unlisten) => unlisten()))
}

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
 * canvas rather than the page, and a sideways trackpad swipe never goes back or forward in
 * the browser's history.
 */
export function useEditorWheelGuard(): void {
  useLinuxPinchWheel()
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
