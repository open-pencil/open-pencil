import { useEventListener } from '@vueuse/core'

import type { DragState } from './types'
import type { Editor } from '@open-pencil/core/editor'
import type { Ref } from 'vue'

export function setupPanZoom(
  canvasRef: Ref<HTMLCanvasElement | null>,
  editor: Editor,
  drag: Ref<DragState | null>,
  onMouseDown: (e: MouseEvent) => void,
  onMouseMove: (e: MouseEvent) => void,
  onMouseUp: () => void
) {
  const wheelAccum = {
    deltaX: 0,
    deltaY: 0,
    zoomDelta: 0,
    zoomCenterX: 0,
    zoomCenterY: 0,
    hasZoom: false,
    rafId: 0
  }

  function flushWheel() {
    wheelAccum.rafId = 0
    editor.setHoveredNode(null)
    if (wheelAccum.hasZoom) {
      editor.applyZoom(wheelAccum.zoomDelta, wheelAccum.zoomCenterX, wheelAccum.zoomCenterY)
    } else {
      editor.pan(wheelAccum.deltaX, wheelAccum.deltaY)
    }
    wheelAccum.deltaX = 0
    wheelAccum.deltaY = 0
    wheelAccum.zoomDelta = 0
    wheelAccum.hasZoom = false
  }

  function normalizeWheelDelta(e: WheelEvent): { dx: number; dy: number } {
    let { deltaX, deltaY } = e
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      deltaX *= 40
      deltaY *= 40
    } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      deltaX *= 800
      deltaY *= 800
    }
    return { dx: deltaX, dy: deltaY }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const canvas = canvasRef.value
    if (!canvas) return
    const { dx, dy } = normalizeWheelDelta(e)

    if (e.ctrlKey || e.metaKey) {
      const rect = canvas.getBoundingClientRect()
      wheelAccum.zoomCenterX = e.clientX - rect.left
      wheelAccum.zoomCenterY = e.clientY - rect.top
      wheelAccum.zoomDelta += dy
      wheelAccum.hasZoom = true
    } else {
      wheelAccum.deltaX -= dx
      wheelAccum.deltaY -= dy
    }
    if (!wheelAccum.rafId) {
      wheelAccum.rafId = requestAnimationFrame(flushWheel)
    }
  }

  let activeTouches: Touch[] = []
  let pinchStartDist = 0
  let pinchStartZoom = 0
  let pinchMidX = 0
  let pinchMidY = 0

  function touchDist(a: Touch, b: Touch) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }

  let touchAsMouse = false

  function syntheticMouse(type: string, t: Touch): MouseEvent {
    return new MouseEvent(type, {
      clientX: t.clientX,
      clientY: t.clientY,
      screenX: t.screenX,
      screenY: t.screenY,
      button: 0,
      buttons: 1,
      bubbles: true
    })
  }

  function onTouchStart(e: TouchEvent) {
    e.preventDefault()
    activeTouches = Array.from(e.touches)
    const canvas = canvasRef.value
    if (!canvas) return

    if (activeTouches.length === 2) {
      if (touchAsMouse) {
        onMouseUp()
        touchAsMouse = false
      }
      drag.value = null
      const [a, b] = activeTouches
      pinchStartDist = touchDist(a, b)
      pinchStartZoom = editor.state.zoom
      const rect = canvas.getBoundingClientRect()
      pinchMidX = (a.clientX + b.clientX) / 2 - rect.left
      pinchMidY = (a.clientY + b.clientY) / 2 - rect.top
    } else if (activeTouches.length === 1) {
      const t = activeTouches[0]
      const tool = editor.state.activeTool
      if (tool === 'HAND') {
        touchAsMouse = false
        drag.value = {
          type: 'pan',
          startScreenX: t.clientX,
          startScreenY: t.clientY,
          startPanX: editor.state.panX,
          startPanY: editor.state.panY
        }
      } else {
        touchAsMouse = true
        onMouseDown(syntheticMouse('mousedown', t))
      }
    }
  }

  function onTouchMove(e: TouchEvent) {
    e.preventDefault()
    activeTouches = Array.from(e.touches)
    const canvas = canvasRef.value
    if (!canvas) return

    if (activeTouches.length === 2) {
      const [a, b] = activeTouches
      const rect = canvas.getBoundingClientRect()
      const newMidX = (a.clientX + b.clientX) / 2 - rect.left
      const newMidY = (a.clientY + b.clientY) / 2 - rect.top

      editor.setHoveredNode(null)
      const newDist = touchDist(a, b)
      if (pinchStartDist > 0) {
        const scale = newDist / pinchStartDist
        const newZoom = Math.max(0.02, Math.min(256, pinchStartZoom * scale))
        const zoomRatio = newZoom / editor.state.zoom

        const panDx = newMidX - pinchMidX
        const panDy = newMidY - pinchMidY

        editor.state.panX = pinchMidX - (pinchMidX - editor.state.panX) * zoomRatio + panDx
        editor.state.panY = pinchMidY - (pinchMidY - editor.state.panY) * zoomRatio + panDy
        editor.state.zoom = newZoom
      }

      pinchMidX = newMidX
      pinchMidY = newMidY
      editor.requestRepaint()
    } else if (activeTouches.length === 1) {
      const t = activeTouches[0]
      if (touchAsMouse) {
        onMouseMove(syntheticMouse('mousemove', t))
      } else if (drag.value?.type === 'pan') {
        const d = drag.value
        editor.state.panX = d.startPanX + (t.clientX - d.startScreenX)
        editor.state.panY = d.startPanY + (t.clientY - d.startScreenY)
        editor.requestRepaint()
      }
    }
  }

  function onTouchEnd(e: TouchEvent) {
    e.preventDefault()
    activeTouches = Array.from(e.touches)

    if (activeTouches.length === 0) {
      if (touchAsMouse) {
        onMouseUp()
        touchAsMouse = false
      } else {
        drag.value = null
      }
      pinchStartDist = 0
    } else if (activeTouches.length === 1) {
      const t = activeTouches[0]
      if (!touchAsMouse) {
        drag.value = {
          type: 'pan',
          startScreenX: t.clientX,
          startScreenY: t.clientY,
          startPanX: editor.state.panX,
          startPanY: editor.state.panY
        }
      }
      pinchStartDist = 0
    }
  }

  useEventListener(canvasRef, 'wheel', onWheel, { passive: false })
  useEventListener(canvasRef, 'touchstart', onTouchStart, { passive: false })
  useEventListener(canvasRef, 'touchmove', onTouchMove, { passive: false })
  useEventListener(canvasRef, 'touchend', onTouchEnd, { passive: false })
  useEventListener(canvasRef, 'touchcancel', onTouchEnd, { passive: false })

  let gestureStartZoom = 1
  let gestureRafId = 0
  let pendingGesture: { scale: number; sx: number; sy: number } | null = null

  function flushGesture() {
    gestureRafId = 0
    if (!pendingGesture) return
    editor.setHoveredNode(null)
    const { scale, sx, sy } = pendingGesture
    pendingGesture = null
    const newZoom = Math.max(0.02, Math.min(256, gestureStartZoom * scale))
    const zoomRatio = newZoom / editor.state.zoom
    editor.state.panX = sx - (sx - editor.state.panX) * zoomRatio
    editor.state.panY = sy - (sy - editor.state.panY) * zoomRatio
    editor.state.zoom = newZoom
    editor.requestRepaint()
  }

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
      if (!gestureRafId) {
        gestureRafId = requestAnimationFrame(flushGesture)
      }
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
