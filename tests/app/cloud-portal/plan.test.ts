import { describe, expect, test } from 'bun:test'

import { effectScope, nextTick } from 'vue'

import type {
  AccountEntitlements,
  BillingAccount,
  BillingCatalog
} from '@open-pencil/cloud/contract'

import {
  planCreditPacks,
  planOffers,
  portalPlan,
  usePortalPlan,
  type PortalPlanServices
} from '@/app/cloud-portal/plan'

const MB = 1024 * 1024

const entitlements: AccountEntitlements = {
  features: {
    links: true,
    guestView: true,
    guestEdit: true,
    guestPresence: true,
    collaboration: true,
    revisionHistory: true,
    cloudServices: true
  },
  limits: {
    maximumFileBytes: 100 * MB,
    maximumStorageBytes: 10_240 * MB,
    maximumParticipants: null,
    monthlyCreditAllowance: 3000
  },
  usage: { committedStorageBytes: 212 * MB, reservedStorageBytes: 0 }
}

const catalog: BillingCatalog = {
  plans: [
    {
      id: 'pro',
      name: 'Pro',
      monthlyPriceCents: 1000,
      storageBytes: 10_240 * MB,
      monthlyCredits: 3000
    }
  ],
  creditPacks: [{ id: 'credits-5k', credits: 5000, priceCents: 500, validDays: 365 }]
}

const subscribed: BillingAccount = {
  subscription: {
    planId: 'pro',
    status: 'active',
    currentPeriodEnd: '2026-12-12T00:00:00.000Z',
    cancelsAtPeriodEnd: false
  }
}

const day = (iso: string) => iso.slice(0, 10)

async function settle() {
  await nextTick()
  await new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

/** Services answering as each test says, recording what the page asked billing for and opened. */
function services(answers: {
  account?: () => Promise<BillingAccount>
  catalog?: () => Promise<BillingCatalog>
}) {
  const calls: string[] = []
  const value: PortalPlanServices = {
    entitlements: async () => entitlements,
    billing: {
      account: answers.account ?? (async () => subscribed),
      catalog: answers.catalog ?? (async () => catalog),
      async checkout(request) {
        calls.push(`checkout ${JSON.stringify(request)}`)
        return 'https://checkout.stripe.com/session'
      },
      async portal() {
        calls.push('portal')
        return 'https://billing.stripe.com/session'
      }
    },
    openPage: (url) => calls.push(`open ${url}`)
  }
  return { value, calls }
}

function plan(value: PortalPlanServices) {
  const page = effectScope(true).run(() => usePortalPlan(value))
  if (!page) throw new Error('The plan page did not start')
  return page
}

describe('portalPlan', () => {
  test('names the subscribed plan, and calls an account without one Free', () => {
    expect(portalPlan(entitlements, subscribed, catalog, day)).toMatchObject({
      known: true,
      name: 'Pro',
      status: 'active',
      periodEnd: '2026-12-12',
      storage: { usedBytes: 212 * MB, totalBytes: 10_240 * MB },
      monthlyCredits: 3000
    })
    expect(portalPlan(entitlements, { subscription: null }, catalog, day)).toMatchObject({
      known: true,
      name: null,
      status: null
    })
  })

  test('names no plan until billing has said what the account subscribes to', () => {
    expect(portalPlan(entitlements, null, catalog, day)).toMatchObject({
      known: false,
      name: null,
      status: null
    })
  })

  test('falls back to the plan ID when the catalog doesn’t list it or can’t be read', () => {
    expect(portalPlan(entitlements, subscribed, null, day).name).toBe('pro')
    expect(portalPlan(entitlements, subscribed, { plans: [], creditPacks: [] }, day).name).toBe(
      'pro'
    )
  })

  test('shows no monthly credits on a plan without services', () => {
    const withoutServices = {
      ...entitlements,
      features: { ...entitlements.features, cloudServices: false }
    }
    expect(portalPlan(withoutServices, subscribed, catalog, day).monthlyCredits).toBeNull()
  })

  test('offers nothing without a catalog', () => {
    expect(planOffers(null)).toEqual([])
    expect(planCreditPacks(null)).toEqual([])
    expect(planOffers(catalog).map((offer) => offer.id)).toEqual(['pro'])
    expect(planCreditPacks(catalog).map((pack) => pack.id)).toEqual(['credits-5k'])
  })
})

describe('usePortalPlan', () => {
  test('keeps the subscription, and Manage billing, while only the catalog fails', async () => {
    const page = plan(services({ catalog: () => Promise.reject(new Error('catalog down')) }).value)
    await settle()
    expect(page.plan.value).toMatchObject({ known: true, name: 'pro', status: 'active' })
    expect(page.offers.value).toEqual([])
    expect(page.creditPacks.value).toEqual([])
    expect(page.billingError.value).not.toBeNull()
  })

  test('shows Cloud’s limits without naming a plan when billing can’t be reached', async () => {
    const down = () => Promise.reject(new Error('billing down'))
    const page = plan(services({ account: down, catalog: down }).value)
    await settle()
    expect(page.plan.value).toMatchObject({ known: false, name: null })
    expect(page.plan.value?.storage.usedBytes).toBe(212 * MB)
    expect(page.billingError.value).not.toBeNull()
  })

  test('opens the provider’s page for what the person chose', async () => {
    const { value, calls } = services({})
    const page = plan(value)
    await settle()
    await page.subscribe('pro')
    await page.buy('credits-5k')
    await page.manage()
    expect(calls).toEqual([
      'checkout {"planId":"pro"}',
      'open https://checkout.stripe.com/session',
      'checkout {"creditPackId":"credits-5k"}',
      'open https://checkout.stripe.com/session',
      'portal',
      'open https://billing.stripe.com/session'
    ])
    expect(page.opening.error.value).toBeNull()
  })
})
