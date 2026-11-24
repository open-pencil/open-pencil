import { expect, test } from 'bun:test'

import {
  easingBezier,
  easingPreset,
  easingSpring,
  easingText,
  springBounce,
  springWithBounce
} from '#scene-graph/variables/easing'

test('a spring’s bounce is one less its damping ratio, as Figma reads it', () => {
  expect(springBounce({ stiffness: 100, damping: 15, mass: 1 })).toBe(0.25)
  expect(springBounce({ stiffness: 300, damping: 20, mass: 1 })).toBeCloseTo(0.4226, 4)
  // An overdamped spring does not bounce.
  expect(springBounce({ stiffness: 80, damping: 20, mass: 1 })).toBe(0)
})

test('a spring set by its bounce keeps stiffness 100 and mass 1', () => {
  expect(springWithBounce(0.4)).toEqual({ stiffness: 100, damping: 12, mass: 1 })
  expect(springBounce(springWithBounce(0.7))).toBeCloseTo(0.7, 10)
})

test('a preset gives its own curve or spring when it has none of its own saved', () => {
  expect(easingBezier({ easing: 'OUT_CUBIC' })).toEqual({ x1: 0, y1: 0, x2: 0.58, y2: 1 })
  expect(easingSpring({ easing: 'SPRING_PRESET_TWO' })).toEqual({
    stiffness: 600,
    damping: 15,
    mass: 1
  })
  expect(easingBezier({ easing: 'GENTLE_SPRING' })).toBeUndefined()
  expect(easingPreset('HOLD')).toEqual({ easing: 'HOLD' })
})

test('an easing reads as Figma’s table writes it', () => {
  expect(easingText({ easing: 'IN_CUBIC' })).toBe('Ease in')
  expect(easingText(easingPreset('SPRING_PRESET_ONE'))).toBe('Quick')
  expect(easingText({ easing: 'CUSTOM_SPRING', spring: springWithBounce(0.4) })).toBe(
    'spring(0.4)'
  )
  expect(
    easingText({
      easing: 'CUSTOM_SPRING',
      spring: { stiffness: 100, damping: 12, mass: 1, type: 'PHYSICAL' }
    })
  ).toBe('physical-spring(100, 12, 1)')
  expect(
    easingText({ easing: 'CUSTOM_CUBIC', bezier: { x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.9 } })
  ).toBe('cubic-bezier(0.1, 0.2, 0.3, 0.9)')
})
