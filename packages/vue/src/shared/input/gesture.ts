import { useEventListener } from '@vueuse/core'
import { computed, type Ref } from 'vue'

import type { Editor } from '@open-pencil/core'

import { createRafScheduler } from '#vue/shared/input/raf-scheduler'
import { PINCH_SCALE_EXPONENT } from '#vue/shared/input/wheel'

/**
 * Zooms on WebKit pinch gestures, which WebKit reports as gesture events instead of Ctrl+wheel.
 * It listens on the canvas's container, so pinches over layers laid on the canvas, such as
 * Preview's live controls and comment pins, zoom it too; they can forward wheel events, but not
 * gestures.
 */
export function setupSafariGestureZoom(
  canvasRef: Ref<HTMLCanvasElement | null>,
  editor: Editor,
  zoomSpeed: () => number = () => 1
) {
  const surface = computed(() => canvasRef.value?.parentElement ?? null)
  let gestureStartZoom = 1
  let pendingGesture: { scale: number; sx: number; sy: number } | null = null

  function flushGesture() {
    if (!pendingGesture) return
    editor.setHoveredNode(null)
    const { scale, sx, sy } = pendingGesture
    pendingGesture = null
    editor.setZoomAroundPoint(
      gestureStartZoom * scale ** (PINCH_SCALE_EXPONENT * zoomSpeed()),
      sx,
      sy
    )
  }

  const gestureScheduler = createRafScheduler(flushGesture)

  useEventListener(
    surface,
    'gesturestart' as keyof HTMLElementEventMap,
    (e: Event) => {
      e.preventDefault()
      gestureStartZoom = editor.state.zoom
    },
    { passive: false }
  )
  useEventListener(
    surface,
    'gesturechange' as keyof HTMLElementEventMap,
    (e: Event) => {
      e.preventDefault()
      const ge = e as GestureEvent
      const canvas = canvasRef.value
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      pendingGesture = {
        scale: ge.scale,
        sx: ge.clientX - rect.left,
        sy: ge.clientY - rect.top
      }
      gestureScheduler.schedule()
    },
    { passive: false }
  )
  useEventListener(
    surface,
    'gestureend' as keyof HTMLElementEventMap,
    (e: Event) => {
      e.preventDefault()
    },
    { passive: false }
  )
}
