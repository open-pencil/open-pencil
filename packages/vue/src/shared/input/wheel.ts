import type { Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

import { useWheelGesture } from '#vue/shared/gesture/wheel'
import { createRafScheduler } from '#vue/shared/input/raf-scheduler'

type WheelAccum = {
  deltaX: number
  deltaY: number
  zoomDelta: number
  zoomCenterX: number
  zoomCenterY: number
  hasZoom: boolean
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

export function setupWheelPanZoom(canvasRef: Ref<HTMLCanvasElement | null>, editor: Editor) {
  const wheelAccum: WheelAccum = {
    deltaX: 0,
    deltaY: 0,
    zoomDelta: 0,
    zoomCenterX: 0,
    zoomCenterY: 0,
    hasZoom: false
  }

  function flushWheel() {
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

  const wheelScheduler = createRafScheduler(flushWheel)

  function onWheel(e: WheelEvent) {
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
    wheelScheduler.schedule()
  }

  useWheelGesture(
    canvasRef,
    ({ event, last }) => {
      if (!last) onWheel(event)
    },
    {
      eventOptions: { passive: false },
      preventDefault: true
    }
  )
}
