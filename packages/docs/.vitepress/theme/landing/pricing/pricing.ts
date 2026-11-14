import type { BillingCatalog, ServiceCatalog } from '@open-pencil/cloud/contract'
import type { PlanEntitlements } from '@open-pencil/cloud/server'

import { fill } from '../content/messages/fill'
import type { LandingMessages } from '../content/messages/types'
import type { Pricing } from './pricing.data'

type PricingMessages = LandingMessages['pricing']

/** Billing sells in US dollars, written as the visitor's language writes them. */
const CURRENCY = 'USD'

export function formatPrice(cents: number, lang: string): string {
  // Whole dollars read without cents: $10, not $10.00.
  return new Intl.NumberFormat(lang, {
    style: 'currency',
    currency: CURRENCY,
    ...(cents % 100 === 0 && { maximumFractionDigits: 0 })
  }).format(cents / 100)
}

export function formatCount(value: number, lang: string): string {
  return new Intl.NumberFormat(lang).format(value)
}

const BYTE_UNITS = ['kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const

/** A storage size in binary units, as the app counts it, with the unit in the visitor's language. */
export function formatBytes(bytes: number, lang: string): string {
  if (bytes < 1024)
    return new Intl.NumberFormat(lang, { style: 'unit', unit: 'byte' }).format(bytes)
  let value = bytes / 1024
  let index = 0
  while (value >= 1024 && index < BYTE_UNITS.length - 1) {
    value /= 1024
    index += 1
  }
  return new Intl.NumberFormat(lang, {
    style: 'unit',
    unit: BYTE_UNITS[index],
    maximumFractionDigits: value >= 10 ? 0 : 1
  }).format(value)
}

/** A period in whole years when it is one, else in days, pluralised by the visitor's language. */
function formatValidity(days: number, lang: string): string {
  const [unit, value] =
    days % 365 === 0 ? (['year', days / 365] as const) : (['day', days] as const)
  return new Intl.NumberFormat(lang, { style: 'unit', unit, unitDisplay: 'long' }).format(value)
}

/** A plan as a card shows it. */
export type PlanCard = {
  id: string
  name: string
  /** The monthly price, or nothing for the free plan. */
  price: string
  storage: string
  /** Credits each month, or `null` when the plan includes no services. */
  credits: string | null
  /** What else the plan includes, in short phrases. */
  includes: string[]
}

function guestAccess(features: PlanEntitlements['features'], messages: PricingMessages): string[] {
  if (features.guestEdit) return [messages.guestsEdit]
  if (features.guestView) return [messages.guestsView]
  return []
}

/** What the free plan includes beyond storage and credits, as its entitlements say. */
function freeIncludes(free: PlanEntitlements, messages: PricingMessages, lang: string): string[] {
  const { features, limits } = free
  return [
    fill(messages.maximumFile, { size: formatBytes(limits.maximumFileBytes, lang) }),
    ...(features.collaboration
      ? [
          limits.maximumParticipants === null
            ? messages.collaboration
            : fill(messages.collaborationUpTo, {
                count: formatCount(limits.maximumParticipants, lang)
              })
        ]
      : []),
    ...(features.links ? [messages.shareLinks] : []),
    ...guestAccess(features, messages),
    ...(features.revisionHistory ? [messages.revisionHistory] : [])
  ]
}

/** The free plan first, then each plan billing sells, in its order. */
export function planCards(pricing: Pricing, messages: PricingMessages, lang: string): PlanCard[] {
  const { free } = pricing
  const freeCredits =
    free.features.cloudServices && free.limits.monthlyCreditAllowance !== null
      ? free.limits.monthlyCreditAllowance
      : null
  return [
    {
      id: 'free',
      name: messages.free,
      price: formatPrice(0, lang),
      storage:
        free.limits.maximumStorageBytes === null
          ? messages.unlimitedStorage
          : formatBytes(free.limits.maximumStorageBytes, lang),
      credits: freeCredits === null ? null : formatCount(freeCredits, lang),
      includes: freeIncludes(free, messages, lang)
    },
    ...(pricing.catalog?.plans ?? []).map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: formatPrice(plan.monthlyPriceCents, lang),
      storage: formatBytes(plan.storageBytes, lang),
      credits: formatCount(plan.monthlyCredits, lang),
      includes: messages.paidIncludes
    }))
  ]
}

/** A credit pack as the page lists it. */
export type CreditPackRow = { id: string; credits: string; price: string; validity: string }

export function creditPackRows(catalog: BillingCatalog | null, lang: string): CreditPackRow[] {
  return (catalog?.creditPacks ?? []).map((pack) => ({
    id: pack.id,
    credits: formatCount(pack.credits, lang),
    price: formatPrice(pack.priceCents, lang),
    validity: formatValidity(pack.validDays, lang)
  }))
}

/** What credits buy: each model's price per million tokens. */
export type CreditPriceRow = { label: string; input: string; output: string }

export function modelRows(services: ServiceCatalog | null, lang: string): CreditPriceRow[] {
  return (services?.models ?? []).map((model) => ({
    label: model.label,
    input: formatCount(model.creditsPerMillionInputTokens, lang),
    output: formatCount(model.creditsPerMillionOutputTokens, lang)
  }))
}

/** What a web search costs, as a sentence, or `null` when services offer none. */
export function searchPrice(
  services: ServiceCatalog | null,
  messages: PricingMessages,
  lang: string
): string | null {
  return services?.search
    ? fill(messages.rates.search, { credits: formatCount(services.search.creditsPerRequest, lang) })
    : null
}
