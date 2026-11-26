import { describe, expect, test } from 'bun:test'

import { layerAtRest, layerFrame, transitionFrames } from '@open-pencil/scene-graph/slides'
import {
  bezierPosition,
  easingPosition,
  easingPreset,
  easingSpring,
  springPeak
} from '@open-pencil/scene-graph/variables'

describe('slide transitions move slides as Figma does', () => {
  test('Push moves both slides a full width together', () => {
    expect(transitionFrames('PUSH_FROM_RIGHT', 0.5)).toEqual({
      from: { x: -0.5, y: 0, opacity: 1, dim: 0 },
      to: { x: 0.5, y: 0, opacity: 1, dim: 0 },
      above: 'to'
    })
  })

  test('Slide in moves the slide underneath a quarter of the way and darkens it to half', () => {
    const { from, to } = transitionFrames('SLIDE_FROM_RIGHT', 1)
    expect(from).toEqual({ x: -0.25, y: 0, opacity: 1, dim: 0.5 })
    expect(to.x).toBe(0)
  })

  test('the out styles move the way Figma plays them, mirrored from their names', () => {
    // SLIDE_OUT_TO_LEFT shows → in Figma's panel and moves the slide left behind to the right.
    expect(transitionFrames('SLIDE_OUT_TO_LEFT', 0.5).from.x).toBe(0.5)
    expect(transitionFrames('MOVE_OUT_TO_TOP', 0.5).from.y).toBe(0.5)
    expect(transitionFrames('SLIDE_OUT_TO_BOTTOM', 0.5).from.y).toBe(-0.5)
    expect(transitionFrames('SLIDE_OUT_TO_LEFT', 0).to).toEqual({
      x: -0.25,
      y: 0,
      opacity: 1,
      dim: 0.5
    })
  })

  test('Dissolve fades the new slide in over the old, which stays as it is', () => {
    expect(transitionFrames('DISSOLVE', 0.3)).toEqual({
      from: { x: 0, y: 0, opacity: 1, dim: 0 },
      to: { x: 0, y: 0, opacity: 0.3, dim: 0 },
      above: 'to'
    })
  })
})

describe('layer animations', () => {
  test('a layer sliding in starts 300 slide pixels back and fades in', () => {
    const animation = { style: 'SLIDE_FROM_LEFT', phase: 'IN' } as const
    expect(layerFrame(animation, 0)).toEqual({ x: -300, y: 0, opacity: 0 })
    expect(layerFrame(animation, 1)).toEqual({ x: 0, y: 0, opacity: 1 })
  })

  test('an In layer is hidden until its step plays, an Out layer after it', () => {
    expect(layerAtRest({ phase: 'IN' }, false).opacity).toBe(0)
    expect(layerAtRest({ phase: 'OUT' }, true).opacity).toBe(0)
  })
})

describe('easings over time', () => {
  test('a cubic eases over the duration it is given', () => {
    const out = easingPreset('OUT_CUBIC')
    expect(easingPosition(out, 0.5, 1)).toBeCloseTo(
      bezierPosition({ x1: 0, y1: 0, x2: 0.58, y2: 1 }, 0.5)
    )
    // Figma's Ease out was at 0.68 halfway through a one-second transition.
    expect(easingPosition(out, 0.5, 1)).toBeCloseTo(0.68, 1)
    expect(easingPosition(out, 1.5, 3)).toBeCloseTo(easingPosition(out, 0.5, 1))
  })

  test("the spring presets overshoot as much and as soon as Figma's", () => {
    // Measured in Figma's presenter at 60 frames a second: the first peak and when it came.
    const measured = {
      GENTLE_SPRING: { value: 1.027, seconds: 0.46 },
      SPRING_PRESET_ONE: { value: 1.106, seconds: 0.21 },
      SPRING_PRESET_TWO: { value: 1.362, seconds: 0.13 }
    } as const
    for (const [curve, peak] of Object.entries(measured)) {
      const spring = easingSpring(easingPreset(curve as keyof typeof measured))
      const computed = spring && springPeak(spring)
      expect(computed?.value).toBeCloseTo(peak.value, 2)
      expect(Math.abs((computed?.seconds ?? 0) - peak.seconds)).toBeLessThan(0.03)
    }
    // Slow never overshoots, and a spring ignores the duration it is given.
    const slow = easingPreset('SPRING_PRESET_THREE')
    expect(springPeak(easingSpring(slow) ?? { stiffness: 0, damping: 0, mass: 1 })).toBeUndefined()
    expect(easingPosition(slow, 0.2, 1)).toBe(easingPosition(slow, 0.2, 5))
  })
})
