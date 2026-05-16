import { describe, expect, test } from 'bun:test'

import { randomHex, randomIndex, randomInt } from '@open-pencil/core/random'

describe('random helpers', () => {
  test('randomHex returns requested byte length as hex', () => {
    expect(randomHex(0)).toBe('')
    expect(randomHex(8)).toMatch(/^[0-9a-f]{16}$/)
  })

  test('randomHex validates byte count', () => {
    expect(() => randomHex(-1)).toThrow(RangeError)
    expect(() => randomHex(1.5)).toThrow(RangeError)
  })

  test('randomInt returns an integer', () => {
    expect(Number.isInteger(randomInt())).toBe(true)
  })

  test('randomIndex returns a bounded index', () => {
    for (let i = 0; i < 100; i++) {
      const index = randomIndex(10)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(10)
    }
  })

  test('randomIndex validates length', () => {
    expect(() => randomIndex(0)).toThrow(RangeError)
    expect(() => randomIndex(-1)).toThrow(RangeError)
    expect(() => randomIndex(1.5)).toThrow(RangeError)
  })
})
