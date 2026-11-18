import { computed } from 'vue'

import { createCloudBillingClient, type CloudBillingClient } from '@open-pencil/cloud/client'
import type {
  AccountEntitlements,
  BillingAccount,
  BillingCatalog
} from '@open-pencil/cloud/contract'

import { createCloudTokenCache } from '@/app/cloud/tokens'
import { useDateFormat } from '@/app/i18n/date'
import { formatNumber, formatPrice } from '@/app/i18n/number'
import { formatStorageBytes } from '@/app/storage/format-bytes'

import { usePortal } from './context'
import { usePortalAction, usePortalLoad } from './state'

/** The account's plan as the Plan section shows it. */
export type PortalPlan = {
  /** Whether billing has said what the account subscribes to; until then no plan is named. */
  known: boolean
  /** The plan's name, or null on the server's free allowance. */
  name: string | null
  /** `past_due` while a failed payment is retried. */
  status: 'active' | 'past_due' | null
  /** When it renews, or ends when `cancels`. */
  periodEnd: string | null
  cancels: boolean
  storage: { usedBytes: number; totalBytes: number | null }
  /** Credits granted each month, or null when the plan includes no services. */
  monthlyCredits: number | null
}

/** A plan the account can subscribe to. */
export type PortalPlanOffer = {
  id: string
  name: string
  price: string
  storage: string
  credits: string
}

/** Credits an account on a plan can buy once. */
export type PortalCreditPack = {
  id: string
  credits: string
  price: string
  validDays: number
}

/** What the plan page reads and opens: Cloud for the account's limits, billing for the rest. */
export type PortalPlanServices = {
  entitlements(): Promise<AccountEntitlements>
  billing: Pick<CloudBillingClient, 'account' | 'catalog' | 'checkout' | 'portal'>
  /** Leaves for the payment provider's page. */
  openPage(url: string): void
}

/** Billing sells in US dollars. */
const BILLING_CURRENCY = 'USD'

/** The services the server this page is served from offers; the route needs it to bill. */
export function portalPlanServices(): PortalPlanServices {
  const portal = usePortal()
  return {
    entitlements: async () => (await portal.api.entitlements()).entitlements,
    billing: createCloudBillingClient({
      endpoint: portal.discovery.billing?.endpoint ?? '',
      tokens: createCloudTokenCache(() => portal.api.billingToken()),
      fetch: (input, init) => globalThis.fetch(input, init)
    }),
    openPage: (url) => globalThis.location.assign(url)
  }
}

/**
 * The plan as the page shows it: Cloud's limits and usage, named by billing's subscription. Until
 * billing has said what the account subscribes to, `known` is false, so a paid account is never
 * called Free.
 */
export function portalPlan(
  entitlements: AccountEntitlements,
  account: BillingAccount | null,
  catalog: BillingCatalog | null,
  formatDate: (iso: string) => string
): PortalPlan {
  const current = account?.subscription ?? null
  return {
    known: account !== null,
    // A plan the catalog no longer lists, or can't be read, still has its ID to show.
    name: current
      ? (catalog?.plans.find((plan) => plan.id === current.planId)?.name ?? current.planId)
      : null,
    status: current?.status ?? null,
    periodEnd: current ? formatDate(current.currentPeriodEnd) : null,
    cancels: current?.cancelsAtPeriodEnd ?? false,
    storage: {
      usedBytes: entitlements.usage.committedStorageBytes,
      totalBytes: entitlements.limits.maximumStorageBytes
    },
    monthlyCredits: entitlements.features.cloudServices
      ? entitlements.limits.monthlyCreditAllowance
      : null
  }
}

export function planOffers(catalog: BillingCatalog | null): PortalPlanOffer[] {
  return (catalog?.plans ?? []).map((plan) => ({
    id: plan.id,
    name: plan.name,
    price: formatPrice(plan.monthlyPriceCents, BILLING_CURRENCY),
    storage: formatStorageBytes(plan.storageBytes),
    credits: formatNumber(plan.monthlyCredits)
  }))
}

export function planCreditPacks(catalog: BillingCatalog | null): PortalCreditPack[] {
  return (catalog?.creditPacks ?? []).map((pack) => ({
    id: pack.id,
    credits: formatNumber(pack.credits),
    price: formatPrice(pack.priceCents, BILLING_CURRENCY),
    validDays: pack.validDays
  }))
}

/**
 * The signed-in account's plan page: its limits and storage from Cloud, its subscription and what
 * it can buy from billing, and the payment provider's pages to buy or manage it. The subscription
 * and the catalog load apart, so Manage billing stays while only the catalog fails, and the plan
 * still shows from Cloud's side when billing can't be reached.
 */
export function usePortalPlan(services: PortalPlanServices = portalPlanServices()) {
  const dates = useDateFormat()

  const entitlements = usePortalLoad(() => services.entitlements(), null)
  const subscription = usePortalLoad<BillingAccount | null>(() => services.billing.account(), null)
  const catalog = usePortalLoad<BillingCatalog | null>(() => services.billing.catalog(), null)

  const plan = computed(() =>
    entitlements.data.value
      ? portalPlan(entitlements.data.value, subscription.data.value, catalog.data.value, (iso) =>
          dates.format(iso, 'date')
        )
      : null
  )

  /** Opens the provider's page; the plan reads again when the person comes back to this one. */
  const opening = usePortalAction(async (page: () => Promise<string>) => {
    services.openPage(await page())
  })

  return {
    entitlements,
    plan,
    offers: computed(() => planOffers(catalog.data.value)),
    creditPacks: computed(() => planCreditPacks(catalog.data.value)),
    /** What went wrong asking billing, which the page reports without hiding the plan. */
    billingError: computed(() => subscription.error.value ?? catalog.error.value),
    billingLoading: computed(() => subscription.loading.value || catalog.loading.value),
    async reloadBilling() {
      await Promise.all([subscription.reload(), catalog.reload()])
    },
    opening,
    subscribe: (planId: string) => opening.run(() => services.billing.checkout({ planId })),
    buy: (creditPackId: string) => opening.run(() => services.billing.checkout({ creditPackId })),
    manage: () => opening.run(() => services.billing.portal())
  }
}

export type PortalPlanPage = ReturnType<typeof usePortalPlan>
