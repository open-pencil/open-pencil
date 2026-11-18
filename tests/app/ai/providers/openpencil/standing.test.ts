import { describe, expect, test } from 'bun:test'

import { creditStanding } from '@/app/ai/providers/openpencil/standing'

describe('creditStanding', () => {
  test('is low below a tenth of the monthly allowance, and out at nothing left', () => {
    expect(creditStanding(500, 5_000)).toBeNull()
    expect(creditStanding(499, 5_000)).toBe('low')
    expect(creditStanding(0, 5_000)).toBe('out')
  })

  test('is low below 300 credits when the allowance is unknown', () => {
    expect(creditStanding(300, null)).toBeNull()
    expect(creditStanding(299, null)).toBe('low')
  })

  test('counts a plan that grants no monthly credits as known, so bought credits are never low', () => {
    expect(creditStanding(100, 0)).toBeNull()
    expect(creditStanding(0, 0)).toBe('out')
  })

  test('says nothing of a balance that is unknown or unlimited', () => {
    expect(creditStanding(null, 3_000)).toBeNull()
  })
})
