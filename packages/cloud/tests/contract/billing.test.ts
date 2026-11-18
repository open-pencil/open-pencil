import { describe, expect, test } from 'bun:test'

import { billingSeatPricingSchema } from '#cloud/contract'
import * as v from 'valibot'

describe('Cloud billing contract', () => {
  test('seat tiers start at one seat and each later one at more seats', () => {
    const pricing = (tiers: { fromSeats: number; unitPriceCents: number }[]) => ({
      minimum: 5,
      tiers,
      storageBytesPerSeat: 1,
      monthlyCreditsPerSeat: 1
    })
    expect(
      v.is(
        billingSeatPricingSchema,
        pricing([
          { fromSeats: 1, unitPriceCents: 200 },
          { fromSeats: 20, unitPriceCents: 175 }
        ])
      )
    ).toBe(true)
    // No price for the first seats.
    expect(v.is(billingSeatPricingSchema, pricing([{ fromSeats: 10, unitPriceCents: 100 }]))).toBe(
      false
    )
    expect(
      v.is(
        billingSeatPricingSchema,
        pricing([
          { fromSeats: 1, unitPriceCents: 200 },
          { fromSeats: 1, unitPriceCents: 175 }
        ])
      )
    ).toBe(false)
  })
})
