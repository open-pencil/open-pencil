import { describe, expect, test } from 'bun:test'

import {
  creditStanding,
  LOW_CREDIT_FLOOR,
  LOW_CREDIT_SHARE
} from '@/app/ai/providers/openpencil/standing'

describe('creditStanding', () => {
  test('is low below a tenth of the monthly allowance, and out at nothing left', () => {
    const allowance = 3_000
    expect(creditStanding(allowance * LOW_CREDIT_SHARE, allowance)).toBeNull()
    expect(creditStanding(allowance * LOW_CREDIT_SHARE - 1, allowance)).toBe('low')
    expect(creditStanding(0, allowance)).toBe('out')
  })

  test('is low below a few hundred credits when the allowance is unknown', () => {
    expect(creditStanding(LOW_CREDIT_FLOOR, null)).toBeNull()
    expect(creditStanding(LOW_CREDIT_FLOOR - 1, null)).toBe('low')
  })

  test('says nothing of a balance that is unknown or unlimited', () => {
    expect(creditStanding(null, 3_000)).toBeNull()
  })
})
