import { useEventListener } from '@vueuse/core'
import { watch } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'
import {
  exitPresentationFullscreen,
  isFullscreenActive,
  requestPresentationFullscreen
} from '@/app/editor/presentation/fullscreen'
import { exitPresentation } from '@/app/editor/presentation/session'

/**
 * Keeps presentation and fullscreen in agreement for the active editor.
 *
 * Entering presentation (command, menu, or Present control) flips
 * `store.state.presenting`. This composable requests fullscreen on that edge and
 * exits presentation if fullscreen ends by any other route (browser Esc, OS
 * chrome). Presentation still runs when fullscreen is refused.
 */
export function usePresentationSession() {
  const store = useEditorStore()

  watch(
    () => store.state.presenting,
    (presenting, wasPresenting) => {
      if (presenting && !wasPresenting) {
        void requestPresentationFullscreen()
        return
      }
      if (!presenting && wasPresenting) {
        void exitPresentationFullscreen()
      }
    }
  )

  useEventListener(document, 'fullscreenchange', () => {
    if (!store.state.presenting) return
    if (!isFullscreenActive()) {
      // Left fullscreen outside our exit path — drop presentation too.
      store.state.presenting = false
      store.zoomToFit()
    }
  })
}

/** Exit presentation if the store is currently presenting. Safe for tab teardown. */
export function exitPresentationIfActive(store: ReturnType<typeof useEditorStore>) {
  if (store.state.presenting) exitPresentation(store)
}
