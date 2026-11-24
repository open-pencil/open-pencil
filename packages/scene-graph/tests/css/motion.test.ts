import { describe, expect, test } from 'bun:test'

import { parseCSSEasing, parseCSSTime } from '#scene-graph/css'

describe('parseCSSTime', () => {
  test('reads milliseconds and seconds as seconds, a bare number as seconds', () => {
    expect(parseCSSTime('250ms')).toBe(0.25)
    expect(parseCSSTime(' 1.5s ')).toBe(1.5)
    expect(parseCSSTime('2')).toBe(2)
  })

  test('refuses another unit or no number', () => {
    expect(parseCSSTime('2px')).toBeNull()
    expect(parseCSSTime('fast')).toBeNull()
  })
})

describe('parseCSSEasing', () => {
  test('reads keywords as the presets they name', () => {
    expect(parseCSSEasing('ease-in')).toEqual({
      easing: 'EASE_IN',
      bezier: { x1: 0.42, y1: 0, x2: 1, y2: 1 }
    })
    expect(parseCSSEasing('linear')?.easing).toBe('LINEAR')
    expect(parseCSSEasing('step-end')).toEqual({ easing: 'HOLD' })
    expect(parseCSSEasing('ease')).toEqual({
      easing: 'CUSTOM_CUBIC',
      bezier: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }
    })
  })

  test('reads cubic-bezier() as a custom curve, or the preset with its numbers', () => {
    expect(parseCSSEasing('cubic-bezier(0, 0, 0.58, 1)')?.easing).toBe('OUT_CUBIC')
    expect(parseCSSEasing('cubic-bezier(0.1, -0.2, 0.3, 1.4)')).toEqual({
      easing: 'CUSTOM_CUBIC',
      bezier: { x1: 0.1, y1: -0.2, x2: 0.3, y2: 1.4 }
    })
  })

  test('refuses a curve whose x leaves 0 to 1, and anything else', () => {
    expect(parseCSSEasing('cubic-bezier(1.2, 0, 0.3, 1)')).toBeNull()
    expect(parseCSSEasing('cubic-bezier(0.1, 0, 0.3)')).toBeNull()
    expect(parseCSSEasing('steps(4)')).toBeNull()
    expect(parseCSSEasing('ease-in ease-out')).toBeNull()
  })
})
