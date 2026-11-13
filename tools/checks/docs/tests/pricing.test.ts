import { describe, expect, test } from 'bun:test'

import {
  creditPackRows,
  formatPrice,
  modelRows,
  planCards,
  searchCredits
} from '#docs-config/theme/landing/pricing/pricing'
import type { Pricing } from '#docs-config/theme/landing/pricing/pricing.data'

const MB = 1024 ** 2

/** A free plan of 300 MB without services, as the hosted service's file sets it. */
const free: Pricing['free'] = {
  features: {
    links: true,
    guestView: true,
    guestEdit: false,
    guestPresence: true,
    collaboration: true,
    revisionHistory: true,
    cloudServices: false
  },
  limits: {
    maximumFileBytes: 100 * MB,
    maximumStorageBytes: 300 * MB,
    maximumParticipants: 10,
    monthlyCreditAllowance: null
  }
}

const catalog: NonNullable<Pricing['catalog']> = {
  plans: [
    {
      id: 'pro',
      name: 'Pro',
      monthlyPriceCents: 1000,
      storageBytes: 10_240 * MB,
      monthlyCredits: 3000
    }
  ],
  creditPacks: [
    { id: 'credits-5k', credits: 5000, priceCents: 500, validDays: 365 },
    { id: 'credits-trial', credits: 1000, priceCents: 150, validDays: 30 }
  ]
}

const services: NonNullable<Pricing['services']> = {
  models: [
    {
      id: 'anthropic/claude-sonnet-5.5',
      label: 'Claude Sonnet 5.5',
      creditsPerMillionInputTokens: 2600,
      creditsPerMillionOutputTokens: 13_000,
      contextTokens: 1_000_000,
      capabilities: { reasoning: true, vision: true, tools: true }
    }
  ],
  defaultModelID: 'anthropic/claude-sonnet-5.5',
  search: { creditsPerRequest: 9 }
}

describe('pricing page', () => {
  test('shows the free plan as its entitlements say, then each plan billing sells', () => {
    const [freeCard, pro] = planCards({ free, catalog, services })
    expect(freeCard).toMatchObject({
      name: 'Free',
      price: '$0',
      storage: '300 MB',
      credits: null,
      includes: [
        'Files up to 100 MB',
        'Live collaboration with up to 10 people',
        'Share links',
        'Guests can view',
        'Version history'
      ]
    })
    expect(pro).toMatchObject({ name: 'Pro', price: '$10', storage: '10 GB', credits: '3,000' })
  })

  test('offers only the free plan while billing can’t be read', () => {
    expect(planCards({ free, catalog: null, services: null }).map((card) => card.id)).toEqual([
      'free'
    ])
    expect(creditPackRows(null)).toEqual([])
    expect(modelRows(null)).toEqual([])
    expect(searchCredits(null)).toBeNull()
  })

  test('lists credit packs, and what credits buy, from the catalogs', () => {
    expect(creditPackRows(catalog)).toEqual([
      { id: 'credits-5k', credits: '5,000', price: '$5', validity: '1 year' },
      { id: 'credits-trial', credits: '1,000', price: '$1.50', validity: '30 days' }
    ])
    expect(modelRows(services)).toEqual([
      { label: 'Claude Sonnet 5.5', input: '2,600', output: '13,000' }
    ])
    expect(searchCredits(services)).toBe('9')
  })

  test('writes whole dollars without cents', () => {
    expect(formatPrice(2000)).toBe('$20')
    expect(formatPrice(999)).toBe('$9.99')
  })
})
