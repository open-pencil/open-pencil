import { describe, expect, test } from 'bun:test'

import { normalizeDashPattern } from '#core/canvas/strokes'

describe('normalizeDashPattern', () => {
  test('preserves valid values and mirrors odd-length patterns', () => {
    expect(normalizeDashPattern([])).toEqual([])
    expect(normalizeDashPattern([8, 4])).toEqual([8, 4])
    expect(normalizeDashPattern([8])).toEqual([8, 8])
    expect(normalizeDashPattern([8, 4, 2])).toEqual([8, 4, 2, 8, 4, 2])
    expect(normalizeDashPattern([0, -1, Number.NaN])).toEqual([
      0,
      -1,
      Number.NaN,
      0,
      -1,
      Number.NaN
    ])
  })
})
