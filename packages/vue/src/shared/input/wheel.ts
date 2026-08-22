import { useEventListener } from '@vueuse/core'
import { onScopeDispose, type Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import { emitNavigationTrace } from '@open-pencil/core/profiler'

import { createRafScheduler } from '#vue/shared/input/raf-scheduler'

const WHEEL_DELTA_LINE = 1
const WHEEL_DELTA_PAGE = 2

type WheelAccum = {
  deltaX: number
  deltaY: number
  zoomScale: number
  zoomCenterX: number
  zoomCenterY: number
  hasZoom: boolean
}

type WheelPanInput = Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'shiftKey'>
type WheelModifierInput = Pick<WheelEvent, 'ctrlKey' | 'metaKey'>

export type WheelPanDelta = { dx: number; dy: number }

function isMacOs() {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
}

function normalizedWheelDelta(event: WheelPanInput): WheelPanDelta {
  let { deltaX, deltaY } = event
  if (event.deltaMode === WHEEL_DELTA_LINE) {
    deltaX *= 40
    deltaY *= 40
  } else if (event.deltaMode === WHEEL_DELTA_PAGE) {
    deltaX *= 800
    deltaY *= 800
  }
  return { dx: deltaX, dy: deltaY }
}

export function isWheelZoom(event: WheelModifierInput): boolean {
  return event.ctrlKey || event.metaKey
}

export function wheelPanDelta(event: WheelPanInput): WheelPanDelta {
  const delta = normalizedWheelDelta(event)
  if (!event.shiftKey || Math.abs(delta.dx) >= Math.abs(delta.dy)) return delta
  return { dx: delta.dy, dy: 0 }
}

const WHEEL_ZOOM_SPEED = 1.25
const NAVIGATION_SETTLE_DELAY_MS = 120

function wheelDeltaModeScale(event: WheelEvent) {
  if (event.deltaMode === 1) return 0.05
  return event.deltaMode ? 1 : 0.002
}

function wheelZoomDelta(event: WheelEvent) {
  const factor = event.ctrlKey && isMacOs() ? 10 : 1
  return -event.deltaY * wheelDeltaModeScale(event) * factor * WHEEL_ZOOM_SPEED
}

export function setupWheelPanZoom(canvasRef: Ref<HTMLCanvasElement | null>, editor: Editor) {
  const wheelAccum: WheelAccum = {
    deltaX: 0,
    deltaY: 0,
    zoomScale: 1,
    zoomCenterX: 0,
    zoomCenterY: 0,
    hasZoom: false
  }

  let settleTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleSettle() {
    if (settleTimer !== null) clearTimeout(settleTimer)
    editor.setNavigationPhase('settling', performance.now())
    settleTimer = setTimeout(() => {
      settleTimer = null
      editor.setNavigationPhase('idle', performance.now())
      editor.requestRepaint()
    }, NAVIGATION_SETTLE_DELAY_MS)
  }

  function flushWheel() {
    emitNavigationTrace('wheel:flush', {
      deltaX: wheelAccum.deltaX,
      deltaY: wheelAccum.deltaY,
      zoomScale: wheelAccum.zoomScale,
      zoom: wheelAccum.hasZoom
    })
    editor.setHoveredNode(null)
    if (wheelAccum.hasZoom) {
      editor.setZoomAroundPoint(
        editor.state.zoom * wheelAccum.zoomScale,
        wheelAccum.zoomCenterX,
        wheelAccum.zoomCenterY
      )
    } else {
      editor.pan(wheelAccum.deltaX, wheelAccum.deltaY)
    }
    wheelAccum.deltaX = 0
    wheelAccum.deltaY = 0
    wheelAccum.zoomScale = 1
    wheelAccum.hasZoom = false
    scheduleSettle()
  }

  const wheelScheduler = createRafScheduler(flushWheel)

  function onWheel(event: WheelEvent) {
    const canvas = canvasRef.value
    if (!canvas) return

    emitNavigationTrace('wheel:received', {
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      clientX: event.clientX,
      clientY: event.clientY,
      trusted: event.isTrusted
    })

    editor.setNavigationPhase(isWheelZoom(event) ? 'zoom' : 'pan', performance.now())

    if (isWheelZoom(event)) {
      const rect = canvas.getBoundingClientRect()
      wheelAccum.zoomCenterX = event.clientX - rect.left
      wheelAccum.zoomCenterY = event.clientY - rect.top
      wheelAccum.zoomScale *= 2 ** wheelZoomDelta(event)
      wheelAccum.hasZoom = true
    } else {
      const { dx, dy } = wheelPanDelta(event)
      wheelAccum.deltaX -= dx
      wheelAccum.deltaY -= dy
    }
    wheelScheduler.schedule()
  }

  useEventListener(
    canvasRef,
    'wheel',
    (event) => {
      event.preventDefault()
      onWheel(event)
    },
    { passive: false }
  )

  onScopeDispose(() => {
    if (settleTimer !== null) clearTimeout(settleTimer)
  })
}
