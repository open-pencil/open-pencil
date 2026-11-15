import { describe, expect, test } from 'bun:test'

import {
  createWheelSteps,
  isWheelZoom,
  PINCH_SCALE_EXPONENT,
  wheelPanDelta,
  type WheelInput,
  type WheelStep
} from '#vue/shared/input/wheel'

function wheelInput(
  deltaX: number,
  deltaY: number,
  options: { deltaMode?: number; shiftKey?: boolean } = {}
) {
  return {
    deltaX,
    deltaY,
    deltaMode: options.deltaMode ?? 0,
    shiftKey: options.shiftKey ?? false
  }
}

describe('wheel navigation', () => {
  test('preserves ordinary vertical and horizontal movement', () => {
    expect(wheelPanDelta(wheelInput(0, 24))).toEqual({ dx: 0, dy: 24 })
    expect(wheelPanDelta(wheelInput(18, 3))).toEqual({ dx: 18, dy: 3 })
  })

  test('converts a vertical Shift+wheel gesture to horizontal movement', () => {
    expect(wheelPanDelta(wheelInput(0, 24, { shiftKey: true }))).toEqual({ dx: 24, dy: 0 })
    expect(wheelPanDelta(wheelInput(2, -16, { shiftKey: true }))).toEqual({ dx: -16, dy: 0 })
  })

  test('keeps native horizontal Shift+trackpad movement horizontal', () => {
    expect(wheelPanDelta(wheelInput(20, 2, { shiftKey: true }))).toEqual({ dx: 20, dy: 2 })
    expect(wheelPanDelta(wheelInput(-12, 0, { shiftKey: true }))).toEqual({ dx: -12, dy: 0 })
  })

  test('normalizes line and page delta modes before axis mapping', () => {
    expect(wheelPanDelta(wheelInput(0, 2, { deltaMode: 1, shiftKey: true }))).toEqual({
      dx: 80,
      dy: 0
    })
    expect(wheelPanDelta(wheelInput(1, 0, { deltaMode: 2 }))).toEqual({ dx: 800, dy: 0 })
  })

  test('gives Ctrl and Meta zoom precedence independently of Shift', () => {
    expect(isWheelZoom({ ctrlKey: true, metaKey: false })).toBeTrue()
    expect(isWheelZoom({ ctrlKey: false, metaKey: true })).toBeTrue()
    expect(isWheelZoom({ ctrlKey: false, metaKey: false })).toBeFalse()
  })
})

function event(deltaY: number, options: Partial<WheelInput> = {}): WheelInput {
  return {
    deltaX: 0,
    deltaY,
    deltaMode: 0,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    timeStamp: 0,
    ...options
  }
}

function notch(timeStamp: number, options: Partial<WheelInput> = {}): WheelInput {
  return event(100, { wheelDeltaX: 0, wheelDeltaY: -120, timeStamp, ...options })
}

function panY(step: WheelStep): number {
  if (step.kind !== 'pan') throw new Error(`expected a pan, got ${step.kind}`)
  return step.dy
}

function zoomScale(step: WheelStep): number {
  if (step.kind !== 'zoom') throw new Error(`expected a zoom, got ${step.kind}`)
  return step.scale
}

describe('wheel steps', () => {
  test('pans twice the touchpad delta, at most 120 px along the movement', () => {
    const step = createWheelSteps('mac')
    expect(step(event(4))).toEqual({ kind: 'pan', dx: 0, dy: 8 })
    expect(step(event(400))).toEqual({ kind: 'pan', dx: 0, dy: 120 })
    const diagonal = step(event(100, { deltaX: 100 }))
    if (diagonal.kind !== 'pan') throw new Error('expected a pan')
    expect(diagonal.dx).toBeCloseTo(84.85, 2)
    expect(diagonal.dy).toBeCloseTo(84.85, 2)
  })

  test('zooms a Ctrl+wheel pinch by 2^(-deltaY / 50) on every platform', () => {
    expect(zoomScale(createWheelSteps('mac')(event(50, { ctrlKey: true })))).toBeCloseTo(0.5)
    expect(zoomScale(createWheelSteps('windows')(event(-4.5, { ctrlKey: true })))).toBeCloseTo(
      2 ** (4.5 / 50)
    )
  })

  test('zooms a Meta+wheel turn more gently and limits one event to 10x', () => {
    const step = createWheelSteps('mac')
    expect(zoomScale(step(event(10, { metaKey: true })))).toBeCloseTo(Math.exp(-0.05))
    expect(zoomScale(step(event(1000, { ctrlKey: true })))).toBeCloseTo(0.1)
  })

  test('scales each zoom by the zoom speed and still limits one event to 10x', () => {
    let speed = 0.25
    const step = createWheelSteps('other', () => speed)
    // A Linux Ctrl+wheel notch reports deltaY 120 and zooms 2^(-120 / 50) at full speed.
    expect(zoomScale(step(event(120, { ctrlKey: true })))).toBeCloseTo(2 ** (-0.25 * 2.4))
    expect(zoomScale(step(event(10, { metaKey: true })))).toBeCloseTo(Math.exp(-0.0125))
    speed = 2
    expect(zoomScale(step(event(-1000, { ctrlKey: true })))).toBeCloseTo(10)
  })

  test('leaves panning at the same rate whatever the zoom speed', () => {
    expect(createWheelSteps('mac', () => 0.25)(event(4))).toEqual({ kind: 'pan', dx: 0, dy: 8 })
  })

  test('moves 16 px per Windows wheel notch and speeds up when notches come within 50 ms', () => {
    const step = createWheelSteps('windows')
    expect(panY(step(notch(0)))).toBe(16)
    expect(panY(step(notch(30)))).toBe(40)
    expect(panY(step(notch(60)))).toBe(100)
    expect(panY(step(notch(90)))).toBe(120)
    expect(panY(step(notch(200)))).toBe(16)
  })

  test('restarts the notch step when the direction changes', () => {
    const step = createWheelSteps('windows')
    expect(panY(step(notch(0)))).toBe(16)
    expect(panY(step(notch(20, { deltaY: -100, wheelDeltaY: 120 })))).toBe(-16)
  })

  test('zooms a Ctrl+notch on Windows like a mouse wheel zoom', () => {
    const step = createWheelSteps('windows')
    expect(zoomScale(step(notch(0, { ctrlKey: true })))).toBeCloseTo(Math.exp(-0.04))
  })

  test('treats fractional Windows deltas and other platforms as touchpad movement', () => {
    expect(panY(createWheelSteps('windows')(event(4.5, { wheelDeltaY: -120 })))).toBe(9)
    expect(panY(createWheelSteps('mac')(notch(0)))).toBe(120)
  })

  test('keeps panning a bounded step through a long fast spin', () => {
    const step = createWheelSteps('windows')
    let last = 0
    for (let index = 0; index < 1000; index++) last = panY(step(notch(index * 10)))
    expect(last).toBe(120)
  })

  test('zooms a WebKit pinch as far as the same pinch zooms in Chromium', () => {
    // Chromium reports a pinch that doubles the finger spread as Ctrl+wheel with -100 ln 2.
    const chromium = zoomScale(createWheelSteps('mac')(event(-100 * Math.LN2, { ctrlKey: true })))
    expect(chromium).toBeCloseTo(2.61, 2)
    expect(2 ** PINCH_SCALE_EXPONENT).toBeCloseTo(chromium)
  })
})
