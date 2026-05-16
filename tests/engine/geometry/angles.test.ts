import { describe, test, expect } from 'bun:test'

import { degToRad, radToDeg } from '@open-pencil/core'

describe('degToRad / radToDeg', () => {
  test('degToRad converts degrees to radians', () => {
    expect(degToRad(0)).toBe(0)
    expect(degToRad(90)).toBeCloseTo(Math.PI / 2, 10)
    expect(degToRad(180)).toBeCloseTo(Math.PI, 10)
    expect(degToRad(360)).toBeCloseTo(Math.PI * 2, 10)
  })

  test('radToDeg converts radians to degrees', () => {
    expect(radToDeg(0)).toBe(0)
    expect(radToDeg(Math.PI / 2)).toBeCloseTo(90, 10)
    expect(radToDeg(Math.PI)).toBeCloseTo(180, 10)
  })

  test('roundtrip preserves value', () => {
    expect(radToDeg(degToRad(45))).toBeCloseTo(45, 10)
    expect(radToDeg(degToRad(-90))).toBeCloseTo(-90, 10)
  })
})

