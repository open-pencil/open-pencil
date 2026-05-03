import { createRafScheduler } from '#vue/shared/input/raf-scheduler'
import { useEventListener } from '@vueuse/core'

import type { Editor } from '@open-pencil/core/editor'
import type { Ref } from 'vue'

export function setupSafariGestureZoom(canvasRef: Ref<HTMLCanvasElement | null>, editor: Editor) {
  let gestureStartZoom = 1
  let pendingGesture: { scale: number; sx: number; sy: number } | null = null

  function flushGesture() {
    if (!pendingGesture) return
    editor.setHoveredNode(null)
    const { scale, sx, sy } = pendingGesture
    pendingGesture = null
    editor.setZoomAroundPoint(gestureStartZoom * scale, sx, sy)
  }

  const gestureScheduler = createRafScheduler(flushGesture)

  useEventListener(
    canvasRef,
    'gesturestart' as keyof HTMLElementEventMap,
    (e: Event) => {
      e.preventDefault()
      gestureStartZoom = editor.state.zoom
    },
    { passive: false }
  )
  useEventListener(
    canvasRef,
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
    canvasRef,
    'gestureend' as keyof HTMLElementEventMap,
    (e: Event) => {
      e.preventDefault()
    },
    { passive: false }
  )
}
