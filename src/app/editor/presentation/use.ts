import { useEventListener } from '@vueuse/core'
import { onScopeDispose, ref, watch } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'
import { openAudienceWindow, type AudienceSession } from '@/app/editor/presentation/audience'
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

  /**
   * Presenting with notes: this window drives, a second window shows the slide.
   *
   * The command only raises `presenterMode`; opening the window belongs here because it
   * needs a window, a channel and a rasteriser. If the window cannot be opened the flag is
   * dropped again rather than leaving a driver with nothing to drive.
   */
  const audience = ref<AudienceSession | null>(null)

  function endPresenterMode() {
    audience.value?.close()
    audience.value = null
    if (store.state.presenterMode) store.state.presenterMode = false
  }

  watch(
    () => store.state.presenterMode,
    (active, wasActive) => {
      if (active && !wasActive) {
        const session = openAudienceWindow(store, () => {
          // Audience window closed by the user — end the mode rather than keep driving
          // a window that is no longer there.
          audience.value = null
          store.state.presenterMode = false
        })
        if (!session) {
          store.state.presenterMode = false
          console.warn('[presentation] could not open the audience window')
          return
        }
        audience.value = session
        void session.render()
        return
      }
      if (!active && wasActive) endPresenterMode()
    }
  )

  // The audience follows the presented slide.
  watch(
    () => store.state.currentPageId,
    () => {
      void audience.value?.render()
    }
  )

  /**
   * A real edit drops that slide's cached raster and redraws it.
   *
   * Driven by graph mutations rather than `sceneVersion`, which `switchPage` bumps on every
   * navigation and which would therefore discard the prerendered slides on arrival.
   */
  function onGraphMutated() {
    const session = audience.value
    if (!session) return
    session.invalidate(store.state.currentPageId)
    void session.render()
  }

  store.onEditorEvent('node:created', onGraphMutated)
  store.onEditorEvent('node:updated', onGraphMutated)
  store.onEditorEvent('node:deleted', onGraphMutated)
  store.onEditorEvent('node:reparented', onGraphMutated)
  store.onEditorEvent('node:reordered', onGraphMutated)

  // Closing the presenter's window must not leave an audience window on a projector with
  // nothing driving it.
  useEventListener(window, 'beforeunload', () => audience.value?.close())
  onScopeDispose(endPresenterMode)
}

/** Exit presentation if the store is currently presenting. Safe for tab teardown. */
export function exitPresentationIfActive(store: ReturnType<typeof useEditorStore>) {
  if (store.state.presenting) exitPresentation(store)
}
