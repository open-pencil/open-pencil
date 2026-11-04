import { describe, expect, test } from 'bun:test'

import { nextGraphemeBoundary, previousGraphemeBoundary } from '#core/text/graphemes'

describe('grapheme boundaries', () => {
  const family = '👨‍👩‍👧‍👦'
  const flag = '🇺🇸'
  const text = `a😀${family}${flag}👍🏽b`
  const boundaries = [
    0,
    1,
    3,
    3 + family.length,
    3 + family.length + 4,
    text.length - 1,
    text.length
  ]

  test('step forward over each user-perceived character whole', () => {
    const steps = [0]
    while (steps.at(-1) !== text.length) steps.push(nextGraphemeBoundary(text, steps.at(-1) ?? 0))
    expect(steps).toEqual(boundaries)
  })

  test('step back over each user-perceived character whole', () => {
    const steps = [text.length]
    while (steps.at(-1) !== 0) steps.push(previousGraphemeBoundary(text, steps.at(-1) ?? 0))
    expect(steps).toEqual([...boundaries].reverse())
  })

  test('stay at the ends of the text', () => {
    expect(previousGraphemeBoundary(text, 0)).toBe(0)
    expect(nextGraphemeBoundary(text, text.length)).toBe(text.length)
  })
})
