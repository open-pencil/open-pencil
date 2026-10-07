import { describe, expect, test } from 'bun:test'

import { easeOutCubic, glideAt, retarget, type Glide } from '@/app/presence/motion'

describe('cursor glides', () => {
  test('ease out starts fast, ends at rest, and clamps outside its range', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(2)).toBe(1)
  })

  test('a glide moves between its points and arrives on time', () => {
    const glide: Glide = { from: { x: 0, y: 0 }, to: { x: 100, y: 50 }, start: 1000, duration: 200 }
    expect(glideAt(glide, 1000)).toEqual({ point: { x: 0, y: 0 }, done: false })
    const half = glideAt(glide, 1100)
    expect(half.done).toBe(false)
    expect(half.point.x).toBeCloseTo(87.5)
    expect(half.point.y).toBeCloseTo(43.75)
    expect(glideAt(glide, 1200)).toEqual({ point: { x: 100, y: 50 }, done: true })
  })

  test('a new cursor appears in place, and a moved one glides on from where it is now', () => {
    const first = retarget(undefined, { x: 10, y: 10 }, 0, 200)
    expect(glideAt(first, 0)).toEqual({ point: { x: 10, y: 10 }, done: true })

    const moving = retarget(first, { x: 110, y: 10 }, 0, 200)
    const midway = glideAt(moving, 100).point
    const redirected = retarget(moving, { x: 110, y: 210 }, 100, 200)
    // It turns from where it is drawn, never jumping back to where it started.
    expect(redirected.from).toEqual(midway)
    expect(retarget(redirected, { x: 110, y: 210 }, 150, 200)).toBe(redirected)
  })
})
