import { describe, expect, test } from 'bun:test'

import { isWheelZoom, wheelPanDelta } from '#vue/shared/input/wheel'

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
