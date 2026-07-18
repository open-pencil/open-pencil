import { describe, expect, test } from 'bun:test'

import { computeWheelPanDelta, type WheelPanInput } from '#vue/shared/input/wheel'

function fakeWheelEvent(opts: Partial<WheelPanInput> = {}): WheelPanInput {
  return {
    deltaX: 0,
    deltaY: 0,
    deltaMode: 0,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    ...opts
  }
}

describe('computeWheelPanDelta', () => {
  test('no modifier: passthrough', () => {
    const e = fakeWheelEvent({ deltaX: 100, deltaY: 50 })
    expect(computeWheelPanDelta(e)).toEqual({ dx: 100, dy: 50 })
  })

  test('shift: deltaY becomes dx, dy is zero', () => {
    const e = fakeWheelEvent({ deltaY: 100, shiftKey: true })
    expect(computeWheelPanDelta(e)).toEqual({ dx: 100, dy: 0 })
  })

  test('ctrl: passthrough (zoom is handled separately)', () => {
    const e = fakeWheelEvent({ deltaY: 100, ctrlKey: true })
    expect(computeWheelPanDelta(e)).toEqual({ dx: 0, dy: 100 })
  })

  test('shift + horizontal wheel: dy is zero', () => {
    const e = fakeWheelEvent({ deltaX: 100, shiftKey: true })
    expect(computeWheelPanDelta(e)).toEqual({ dx: 0, dy: 0 })
  })

  test('line mode scales both axes', () => {
    const e = fakeWheelEvent({
      deltaX: 1,
      deltaY: 2,
      deltaMode: 1,
      shiftKey: true
    })
    expect(computeWheelPanDelta(e)).toEqual({ dx: 80, dy: 0 })
  })
})
