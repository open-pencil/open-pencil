import { describe, expect, test } from 'bun:test'

import { effectScope, nextTick } from 'vue'

import type { AccountEntitlements } from '@open-pencil/cloud/contract'

import {
  portalPlan,
  billingSessionForm,
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

async function settle() {
  await nextTick()
  await new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

function plan(value: PortalPlanServices) {
  const page = effectScope(true).run(() => usePortalPlan(value))
  if (!page) throw new Error('The plan page did not start')
  return page
}

describe('portalPlan', () => {
  test('shows the storage used against the limit, and the monthly credits', () => {
    expect(portalPlan(entitlements)).toEqual({
      storage: { usedBytes: 212 * MB, totalBytes: 10_240 * MB },
      monthlyCredits: 3000
    })
  })

  test('shows no monthly credits on a plan without services', () => {
    const withoutServices = {
      ...entitlements,
      features: { ...entitlements.features, cloudServices: false }
    }
    expect(portalPlan(withoutServices).monthlyCredits).toBeNull()
  })
})

describe('usePortalPlan', () => {
  test('sells nothing on a server without billing', async () => {
    const page = plan({ entitlements: async () => entitlements, openBilling: null })
    await settle()
    expect(page.sells).toBe(false)
    expect(page.plan.value?.storage.usedBytes).toBe(212 * MB)
  })

  test('opens billing, and reports why it could not', async () => {
    const opened: string[] = []
    let fails = false
    const page = plan({
      entitlements: async () => entitlements,
      async openBilling(wanted) {
        if (fails) throw new Error('No token')
        if (wanted()) opened.push('billing')
      }
    })
    await settle()
    await page.openBilling()
    expect(opened).toEqual(['billing'])
    expect(page.opening.error.value).toBeNull()
    fails = true
    await page.openBilling()
    expect(page.opening.error.value).not.toBeNull()
  })

  test('drops a handoff still waiting for its token once the person leaves the page', async () => {
    const opened: string[] = []
    const token = Promise.withResolvers<undefined>()
    const page = plan({
      entitlements: async () => entitlements,
      async openBilling(wanted) {
        await token.promise
        if (wanted()) opened.push('billing')
      }
    })
    await settle()
    const opening = page.openBilling()
    page.cancelBilling()
    token.resolve(undefined)
    await opening
    expect(opened).toEqual([])
  })
})

describe('billingSessionForm', () => {
  test("posts the token in a form to billing's session page, never in the address", () => {
    expect(billingSessionForm('https://billing.example.com', 'signed-token')).toEqual({
      action: 'https://billing.example.com/session',
      method: 'POST',
      fields: { token: 'signed-token' }
    })
  })
})
