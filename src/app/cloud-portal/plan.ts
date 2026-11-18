import { joinURL } from 'ufo'
import { computed } from 'vue'

import { CLOUD_BILLING_PAGE_PATHS, type AccountEntitlements } from '@open-pencil/cloud/contract'

import { usePortal } from './context'
import { usePortalAction, usePortalLoad } from './state'

/** The account's plan as the Plan section shows it: what Cloud enforces, and what it uses. */
export type PortalPlan = {
  storage: { usedBytes: number; totalBytes: number | null }
  /** Credits granted each month, or null when the plan includes no services. */
  monthlyCredits: number | null
}

/**
 * What the plan page reads and opens: Cloud for the account's limits, and the server's billing
 * service, when it advertises one, for buying and managing a plan on billing's own pages.
 */
export type PortalPlanServices = {
  entitlements(): Promise<AccountEntitlements>
  /**
   * Opens billing signed in as this account, unless `wanted` says the person has moved on while
   * the token was on its way; `null` when the server sells nothing.
   */
  openBilling: ((wanted: () => boolean) => Promise<void>) | null
}

/** Where and how a billing token reaches billing's session page. */
export function billingSessionForm(endpoint: string, token: string) {
  return {
    // Below the endpoint, which may itself have a path.
    action: joinURL(endpoint, CLOUD_BILLING_PAGE_PATHS.session),
    method: 'POST',
    fields: { token }
  } as const
}

/**
 * Signs the person in to billing's own pages: posts a fresh billing token to its session page,
 * as a form so the token leaves in the body, never in an address that history or logs keep.
 */
function postBillingToken(endpoint: string, token: string) {
  const { action, method, fields } = billingSessionForm(endpoint, token)
  const form = document.createElement('form')
  form.action = action
  form.method = method
  form.hidden = true
  for (const [name, value] of Object.entries(fields)) {
    const field = document.createElement('input')
    field.type = 'hidden'
    field.name = name
    field.value = value
    form.append(field)
  }
  document.body.append(form)
  try {
    form.submit()
  } finally {
    // The browser has the post's fields once `submit` returns; the token leaves the page with it.
    form.remove()
  }
}

/** The services the server this page is served from offers. */
export function portalPlanServices(): PortalPlanServices {
  const portal = usePortal()
  const endpoint = portal.discovery.billing?.endpoint
  return {
    entitlements: async () => (await portal.api.entitlements()).entitlements,
    openBilling: endpoint
      ? async (wanted) => {
          const { token } = await portal.api.billingToken()
          if (wanted()) postBillingToken(endpoint, token)
        }
      : null
  }
}

export function portalPlan(entitlements: AccountEntitlements): PortalPlan {
  return {
    storage: {
      usedBytes: entitlements.usage.committedStorageBytes,
      totalBytes: entitlements.limits.maximumStorageBytes
    },
    monthlyCredits: entitlements.features.cloudServices
      ? entitlements.limits.monthlyCreditAllowance
      : null
  }
}

/**
 * The signed-in account's plan page: its limits and storage from Cloud, and the way to billing's
 * own pages, where the plan is bought, changed, and paid for.
 */
export function usePortalPlan(services: PortalPlanServices = portalPlanServices()) {
  const entitlements = usePortalLoad(() => services.entitlements(), null)
  const plan = computed(() =>
    entitlements.data.value ? portalPlan(entitlements.data.value) : null
  )
  /** Counts the handoffs started, so leaving the page drops one still waiting for its token. */
  let handoffs = 0
  const opening = usePortalAction(async () => {
    const handoff = ++handoffs
    await services.openBilling?.(() => handoff === handoffs)
  })
  return {
    entitlements,
    plan,
    /** Whether the server sells plans; without billing the page shows only the limits. */
    sells: services.openBilling !== null,
    opening,
    openBilling: () => opening.run(),
    /** Drops a handoff still waiting for its token, as when the person leaves the page. */
    cancelBilling() {
      handoffs += 1
    }
  }
}

export type PortalPlanPage = ReturnType<typeof usePortalPlan>
