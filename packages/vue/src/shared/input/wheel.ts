import { useEventListener } from '@vueuse/core'
import { onScopeDispose, type Ref } from 'vue'

import type { Editor } from '@open-pencil/core'
import { emitNavigationTrace } from '@open-pencil/core/profiler'

import { createRafScheduler } from '#vue/shared/input/raf-scheduler'

const WHEEL_DELTA_LINE = 1
const WHEEL_DELTA_PAGE = 2

/*
 * Wheel navigation follows Figma's, measured in Figma 126 with real trackpad recordings and its
 * own wheel handler. Every event pans twice its delta, at most 120 px. Ctrl+wheel, which is how
 * Chromium reports a touchpad pinch (deltaY = -100 ln scale), zooms by 2^(-deltaY / 50); a
 * mouse wheel zoom (Meta+wheel, or Ctrl with a Windows wheel notch) zooms by e^(-0.005 deltaY).
 */
const PAN_SCALE = 2
const MAX_PAN_PER_EVENT = 120
const PINCH_ZOOM_PER_DELTA = Math.LN2 / 50
const WHEEL_ZOOM_PER_DELTA = 0.005
const MAX_ZOOM_STEP = Math.log(10)

/*
 * Windows reports each mouse wheel notch as wheelDelta 120. Figma moves 8 units per notch and
 * multiplies the step by 2.5 for each notch that follows within 50 ms in the same direction, up
 * to 120 units, or 40 while zooming, so a slow turn moves 16 px and a fast spin speeds up.
 */
const WHEEL_NOTCH = 120
const MIN_WHEEL_NOTCH = 99
const NOTCH_STEP = 8
const NOTCH_ACCELERATION = 2.5
const NOTCH_ACCELERATION_WINDOW_MS = 50
const MAX_NOTCH_PAN = 120
const MAX_NOTCH_ZOOM = 40

/**
 * Chromium encodes a pinch as Ctrl+wheel with deltaY = -100 ln(scale), while WebKit reports the
 * gesture's scale. Raising the scale to this power zooms a WebKit pinch as far as the same pinch
 * zooms in Chromium.
 */
export const PINCH_SCALE_EXPONENT = 100 * PINCH_ZOOM_PER_DELTA

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

/** The wheel event fields navigation reads; `wheelDeltaX/Y` are Chromium's legacy notch fields. */
export type WheelInput = WheelPanInput &
  WheelModifierInput &
  Pick<WheelEvent, 'timeStamp'> & { wheelDeltaX?: number; wheelDeltaY?: number }

export type WheelPanDelta = { dx: number; dy: number }
export type WheelPlatform = 'mac' | 'windows' | 'other'
export type WheelStep = { kind: 'pan'; dx: number; dy: number } | { kind: 'zoom'; scale: number }

export function currentWheelPlatform(): WheelPlatform {
  if (typeof navigator === 'undefined') return 'other'
  if (/Mac|iPhone|iPad|iPod/.test(navigator.platform)) return 'mac'
  return /Win/.test(navigator.platform) ? 'windows' : 'other'
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

function shiftToHorizontal(delta: WheelPanDelta, shiftKey: boolean): WheelPanDelta {
  if (!shiftKey || Math.abs(delta.dx) >= Math.abs(delta.dy)) return delta
  return { dx: delta.dy, dy: 0 }
}

export function wheelPanDelta(event: WheelPanInput): WheelPanDelta {
  return shiftToHorizontal(normalizedWheelDelta(event), event.shiftKey)
}

function capLength(delta: WheelPanDelta, max: number): WheelPanDelta {
  const length = Math.hypot(delta.dx, delta.dy)
  if (length <= max) return delta
  return { dx: (delta.dx * max) / length, dy: (delta.dy * max) / length }
}

/** Whole wheel notches in deltaY's direction, when this Windows event is a mouse wheel notch. */
function windowsNotches(event: WheelInput): WheelPanDelta | null {
  if (!Number.isInteger(event.deltaX) || !Number.isInteger(event.deltaY)) return null
  const notches =
    event.wheelDeltaX !== undefined && event.wheelDeltaY !== undefined
      ? { dx: -event.wheelDeltaX, dy: -event.wheelDeltaY }
      : normalizedWheelDelta(event)
  if (Math.abs(notches.dx) < MIN_WHEEL_NOTCH && Math.abs(notches.dy) < MIN_WHEEL_NOTCH) return null
  return { dx: notches.dx / WHEEL_NOTCH, dy: notches.dy / WHEEL_NOTCH }
}

function zoomStep(delta: number, perDelta: number): WheelStep {
  const exponent = Math.max(-MAX_ZOOM_STEP, Math.min(MAX_ZOOM_STEP, -delta * perDelta))
  return { kind: 'zoom', scale: Math.exp(exponent) }
}

/**
 * Turns wheel events into pan and zoom steps. It keeps the last Windows notch so a fast spin
 * accelerates, so each canvas uses its own. `zoomSpeed` multiplies how far each event zooms.
 */
export function createWheelSteps(
  platform: WheelPlatform = currentWheelPlatform(),
  zoomSpeed: () => number = () => 1
) {
  let lastNotch = { time: Number.NEGATIVE_INFINITY, signX: 0, signY: 0, step: 0 }

  function notchStep(event: WheelInput, notches: WheelPanDelta, zoom: boolean): WheelPanDelta {
    const time = event.timeStamp
    const signX = Math.sign(notches.dx)
    const signY = Math.sign(notches.dy)
    const accelerates =
      time - lastNotch.time < NOTCH_ACCELERATION_WINDOW_MS &&
      signX === lastNotch.signX &&
      signY === lastNotch.signY
    // The step stops growing at the largest movement, so a long fast spin cannot overflow it.
    const step = accelerates
      ? Math.min(lastNotch.step * NOTCH_ACCELERATION, MAX_NOTCH_PAN)
      : NOTCH_STEP
    lastNotch = { time, signX, signY, step }
    return capLength(
      { dx: notches.dx * step, dy: notches.dy * step },
      zoom ? MAX_NOTCH_ZOOM : MAX_NOTCH_PAN
    )
  }

  return function wheelStep(event: WheelInput): WheelStep {
    const zoom = isWheelZoom(event)
    const notches = platform === 'windows' ? windowsNotches(event) : null
    const delta = notches ? notchStep(event, notches, zoom) : normalizedWheelDelta(event)

    if (zoom) {
      const perDelta = event.ctrlKey && !notches ? PINCH_ZOOM_PER_DELTA : WHEEL_ZOOM_PER_DELTA
      return zoomStep(delta.dy, perDelta * zoomSpeed())
    }

    const pan = shiftToHorizontal(delta, event.shiftKey)
    const { dx, dy } = capLength(
      { dx: pan.dx * PAN_SCALE, dy: pan.dy * PAN_SCALE },
      MAX_PAN_PER_EVENT
    )
    return { kind: 'pan', dx, dy }
  }
}

const NAVIGATION_SETTLE_DELAY_MS = 120

/**
 * Wheel and pinch zoom on the canvas. `zoomSpeed` scales how far each event zooms: 1 keeps
 * Figma's rate, 0.5 zooms half as far.
 */
export function setupWheelPanZoom(
  canvasRef: Ref<HTMLCanvasElement | null>,
  editor: Editor,
  zoomSpeed: () => number = () => 1
) {
  const wheelAccum: WheelAccum = {
    deltaX: 0,
    deltaY: 0,
    zoomScale: 1,
    zoomCenterX: 0,
    zoomCenterY: 0,
    hasZoom: false
  }

  const wheelStep = createWheelSteps(currentWheelPlatform(), zoomSpeed)
  let settleTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleSettle() {
    if (settleTimer !== null) clearTimeout(settleTimer)
    editor.setNavigationPhase('settling')
    settleTimer = setTimeout(() => {
      settleTimer = null
      editor.setNavigationPhase('idle')
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

    const step = wheelStep(event)
    editor.setNavigationPhase(step.kind, performance.now())

    if (step.kind === 'zoom') {
      const rect = canvas.getBoundingClientRect()
      wheelAccum.zoomCenterX = event.clientX - rect.left
      wheelAccum.zoomCenterY = event.clientY - rect.top
      wheelAccum.zoomScale *= step.scale
      wheelAccum.hasZoom = true
    } else {
      wheelAccum.deltaX -= step.dx
      wheelAccum.deltaY -= step.dy
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
