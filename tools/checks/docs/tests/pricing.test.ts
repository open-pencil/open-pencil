import { describe, expect, test } from 'bun:test'

import { de } from '#docs-config/theme/landing/content/messages/de'
import { en } from '#docs-config/theme/landing/content/messages/en'
import {
  creditPackRows,
  formatBytes,
  formatPrice,
  modelRows,
  planCards,
  searchPrice
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
    const [freeCard, pro] = planCards({ free, catalog, services }, en.pricing, 'en-US')
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
    expect(
      planCards({ free, catalog: null, services: null }, en.pricing, 'en-US').map((card) => card.id)
    ).toEqual(['free'])
    expect(creditPackRows(null, 'en-US')).toEqual([])
    expect(modelRows(null, 'en-US')).toEqual([])
    expect(searchPrice(null, en.pricing, 'en-US')).toBeNull()
  })

  test('lists credit packs, and what credits buy, from the catalogs', () => {
    expect(creditPackRows(catalog, 'en-US')).toEqual([
      { id: 'credits-5k', credits: '5,000', price: '$5', validity: '1 year' },
      { id: 'credits-trial', credits: '1,000', price: '$1.50', validity: '30 days' }
    ])
    expect(modelRows(services, 'en-US')).toEqual([
      { label: 'Claude Sonnet 5.5', input: '2,600', output: '13,000' }
    ])
    expect(searchPrice(services, en.pricing, 'en-US')).toBe('A web search costs 9 credits.')
  })

  test('writes whole dollars without cents', () => {
    expect(formatPrice(2000, 'en-US')).toBe('$20')
    expect(formatPrice(999, 'en-US')).toBe('$9.99')
  })

  test('writes prices, sizes, counts and periods in the page’s language', () => {
    // CLDR separates amounts from units with ordinary, no-break or narrow spaces, by locale.
    const spaced = (text: string | undefined) => text?.replace(/\s/g, ' ')
    const [freeCard, pro] = planCards({ free, catalog, services }, de.pricing, 'de')
    expect(spaced(freeCard?.includes[0])).toBe(de.pricing.maximumFile.replace('{size}', '100 MB'))
    expect(spaced(pro?.price)).toBe('10 $')
    expect(spaced(pro?.storage)).toBe('10 GB')
    expect(pro?.credits).toBe('3.000')
    const [pack] = creditPackRows(catalog, 'de')
    expect(spaced(pack?.price)).toBe('5 $')
    expect(spaced(pack?.validity)).toBe('1 Jahr')
    expect(spaced(formatPrice(150, 'de'))).toBe('1,50 $')
    expect(spaced(formatBytes(1.5 * 1024 ** 3, 'ru'))).toBe('1,5 ГБ')
  })
})
