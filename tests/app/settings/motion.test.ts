import { expect, test } from 'bun:test'

import { motionTransitions, resolveMotionTransition } from '@/theme/motion/transitions'

test('motion presets preserve enabled intent and remove duration, delays and springs when off', () => {
  for (const transition of [
    motionTransitions.quick,
    motionTransitions.layout,
    { type: 'spring' as const, stiffness: 800, damping: 50, delay: 2 }
  ]) {
    expect(resolveMotionTransition(true, transition)).toBe(transition)
    expect(resolveMotionTransition(false, transition)).toEqual({ duration: 0 })
  }
})
