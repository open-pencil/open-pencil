import type { BillingCatalog, ServiceCatalog } from '@open-pencil/cloud/contract'
import type { PlanEntitlements } from '@open-pencil/cloud/server'

import { formatStorageBytes } from '@/app/storage/format-bytes'

import type { Pricing } from './pricing.data'

/** Billing sells in US dollars. */
const CURRENCY = 'USD'
/** The Cloud docs are in English only. */
const LANGUAGE = 'en-US'

const price = new Intl.NumberFormat(LANGUAGE, { style: 'currency', currency: CURRENCY })
const count = new Intl.NumberFormat(LANGUAGE)

export function formatPrice(cents: number): string {
  // Whole dollars read without cents: $10, not $10.00.
  return cents % 100 === 0
    ? new Intl.NumberFormat(LANGUAGE, {
        style: 'currency',
        currency: CURRENCY,
        maximumFractionDigits: 0
      }).format(cents / 100)
    : price.format(cents / 100)
}

export function formatCount(value: number): string {
  return count.format(value)
}

/** A plan as a card shows it. */
export type PlanCard = {
  id: string
  name: string
  /** The monthly price, or `$0` for the free plan. */
  price: string
  storage: string
  /** Credits each month, or `null` when the plan includes no services. */
  credits: string | null
  /** What else the plan includes, in short phrases. */
  includes: string[]
}

function guestAccess(features: PlanEntitlements['features']): string[] {
  if (features.guestEdit) return ['Guests can edit']
  if (features.guestView) return ['Guests can view']
  return []
}

/** What the free plan includes beyond storage and credits, as its entitlements say. */
function freeIncludes(free: PlanEntitlements): string[] {
  const { features, limits } = free
  return [
    `Files up to ${formatStorageBytes(limits.maximumFileBytes)}`,
    ...(features.collaboration
      ? [
          limits.maximumParticipants === null
            ? 'Live collaboration'
            : `Live collaboration with up to ${formatCount(limits.maximumParticipants)} people`
        ]
      : []),
    ...(features.links ? ['Share links'] : []),
    ...guestAccess(features),
    ...(features.revisionHistory ? ['Version history'] : [])
  ]
}

/** The free plan first, then each plan billing sells, in its order. */
export function planCards(pricing: Pricing): PlanCard[] {
  const { free } = pricing
  const freeCredits =
    free.features.cloudServices && free.limits.monthlyCreditAllowance !== null
      ? free.limits.monthlyCreditAllowance
      : null
  return [
    {
      id: 'free',
      name: 'Free',
      price: formatPrice(0),
      storage:
        free.limits.maximumStorageBytes === null
          ? 'Unlimited storage'
          : formatStorageBytes(free.limits.maximumStorageBytes),
      credits: freeCredits === null ? null : formatCount(freeCredits),
      includes: freeIncludes(free)
    },
    ...(pricing.catalog?.plans ?? []).map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: formatPrice(plan.monthlyPriceCents),
      storage: formatStorageBytes(plan.storageBytes),
      credits: formatCount(plan.monthlyCredits),
      includes: ['Everything in Free', 'AI and web search in the editor']
    }))
  ]
}

/** A credit pack as the page lists it. */
export type CreditPackRow = { id: string; credits: string; price: string; validity: string }

export function creditPackRows(catalog: BillingCatalog | null): CreditPackRow[] {
  return (catalog?.creditPacks ?? []).map((pack) => ({
    id: pack.id,
    credits: formatCount(pack.credits),
    price: formatPrice(pack.priceCents),
    validity:
      pack.validDays % 365 === 0
        ? `${formatCount(pack.validDays / 365)} ${pack.validDays === 365 ? 'year' : 'years'}`
        : `${formatCount(pack.validDays)} days`
  }))
}

/** What credits buy: each model's price per million tokens, and a web search. */
export type CreditPriceRow = { label: string; input: string; output: string }

export function modelRows(services: ServiceCatalog | null): CreditPriceRow[] {
  return (services?.models ?? []).map((model) => ({
    label: model.label,
    input: formatCount(model.creditsPerMillionInputTokens),
    output: formatCount(model.creditsPerMillionOutputTokens)
  }))
}

export function searchCredits(services: ServiceCatalog | null): string | null {
  return services?.search ? formatCount(services.search.creditsPerRequest) : null
}
