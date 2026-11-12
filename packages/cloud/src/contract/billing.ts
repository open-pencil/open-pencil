import type { Hono } from 'hono'
import type { BlankEnv, BlankInput } from 'hono/types'
import * as v from 'valibot'

import type { JSONRoute } from './routes'

/**
 * The contract between Cloud, its editors, and the billing service a deployment advertises: what
 * plans and credit packs it sells, and where an account buys them or manages what it has. Cloud
 * only advertises the service and signs short-lived tokens for an account; the service talks to
 * the payment provider, and sets the account's entitlements and credits as it is paid.
 */
export const CLOUD_BILLING_CONTRACT_VERSION = '1' as const
/**
 * The `aud` of the tokens Cloud signs for its billing service, with the services' signing key,
 * whose public keys it publishes at `CLOUD_SERVICES_JWKS_PATH`.
 */
export const CLOUD_BILLING_TOKEN_AUDIENCE = 'openpencil-billing' as const

/**
 * The page of a Cloud server where the signed-in person sees their plan, buys a plan or credits,
 * and manages what they pay for; editors link to it whenever the server advertises billing.
 */
export const CLOUD_ACCOUNT_PLAN_PATH = '/account/plan' as const

/** Where the billing service answers, below the discovered `endpoint`. */
export const CLOUD_BILLING_API_PATHS = {
  base: '/v1',
  catalog: '/v1/catalog',
  account: '/v1/account',
  checkout: '/v1/checkout',
  portal: '/v1/portal'
} as const

const urlSchema = v.pipe(v.string(), v.url())
const idSchema = v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9-]{0,62}$/))
const centsSchema = v.pipe(v.number(), v.integer(), v.minValue(0))
const bytesSchema = v.pipe(v.number(), v.integer(), v.minValue(0))
const creditsSchema = v.pipe(v.number(), v.integer(), v.minValue(0))

export const cloudBillingDiscoverySchema = v.object({
  endpoint: urlSchema,
  contractVersion: v.literal(CLOUD_BILLING_CONTRACT_VERSION)
})
export type CloudBillingDiscovery = v.InferOutput<typeof cloudBillingDiscoverySchema>

export const billingTokenSchema = v.object({
  token: v.pipe(v.string(), v.minLength(1)),
  expiresAt: v.pipe(v.string(), v.isoTimestamp())
})
export type BillingToken = v.InferOutput<typeof billingTokenSchema>

/**
 * What the billing service may rely on once a token's signature, issuer, audience, and expiry
 * check. The account is the signed-in user, who buys and manages only their own plan.
 */
export const billingTokenClaimsSchema = v.object({
  iss: urlSchema,
  aud: v.literal(CLOUD_BILLING_TOKEN_AUDIENCE),
  /** The account: the Cloud user whose plan and credits these are. */
  sub: v.pipe(v.string(), v.minLength(1)),
  /** Where the payment provider sends receipts and invoices. */
  email: v.pipe(v.string(), v.email()),
  iat: v.pipe(v.number(), v.integer()),
  exp: v.pipe(v.number(), v.integer())
})
export type BillingTokenClaims = v.InferOutput<typeof billingTokenClaimsSchema>

/** A plan an account subscribes to, billed every month in US dollars before tax. */
export const billingPlanSchema = v.object({
  id: idSchema,
  name: v.pipe(v.string(), v.minLength(1)),
  monthlyPriceCents: centsSchema,
  storageBytes: bytesSchema,
  monthlyCredits: creditsSchema
})
export type BillingPlan = v.InferOutput<typeof billingPlanSchema>

/** Credits an account on a plan buys once, in US dollars before tax. */
export const creditPackSchema = v.object({
  id: idSchema,
  credits: creditsSchema,
  priceCents: centsSchema,
  /** How long the credits last from purchase. */
  validDays: v.pipe(v.number(), v.integer(), v.minValue(1))
})
export type CreditPack = v.InferOutput<typeof creditPackSchema>

/** What the service sells; an account without a plan has its deployment's free entitlements. */
export const billingCatalogSchema = v.object({
  plans: v.array(billingPlanSchema),
  creditPacks: v.array(creditPackSchema)
})
export type BillingCatalog = v.InferOutput<typeof billingCatalogSchema>

/**
 * The account's subscription as the payment provider holds it, or `null` without one. A
 * `past_due` plan keeps its entitlements while payment is retried.
 */
export const billingAccountSchema = v.object({
  subscription: v.nullable(
    v.object({
      planId: idSchema,
      status: v.picklist(['active', 'past_due']),
      /** When the current period ends: the next charge, or the end of a cancelled plan. */
      currentPeriodEnd: v.pipe(v.string(), v.isoTimestamp()),
      /** Whether the plan ends at `currentPeriodEnd` instead of renewing. */
      cancelsAtPeriodEnd: v.boolean()
    })
  )
})
export type BillingAccount = v.InferOutput<typeof billingAccountSchema>

/** What to buy: a plan to subscribe to, or a credit pack. */
export const checkoutRequestSchema = v.union([
  v.object({ planId: idSchema }),
  v.object({ creditPackId: idSchema })
])
export type CheckoutRequest = v.InferOutput<typeof checkoutRequestSchema>

/** Where to send the person: the payment provider's checkout or account portal. */
export const billingRedirectSchema = v.object({ url: urlSchema })
export type BillingRedirect = v.InferOutput<typeof billingRedirectSchema>

export const billingErrorCodeSchema = v.picklist([
  'invalid_request',
  'unauthorized',
  /** A credit pack for an account without a plan, or a plan it already has. */
  'not_allowed',
  'provider_unavailable'
])
export type BillingErrorCode = v.InferOutput<typeof billingErrorCodeSchema>

/** The HTTP status billing answers each error with. */
export const BILLING_ERROR_STATUS = {
  invalid_request: 400,
  unauthorized: 401,
  not_allowed: 409,
  provider_unavailable: 502
} as const satisfies Record<BillingErrorCode, number>

export const billingErrorSchema = v.object({
  error: v.object({ code: billingErrorCodeSchema, message: v.optional(v.string()) })
})
export type BillingError = v.InferOutput<typeof billingErrorSchema>

/** The billing service's routes, for a typed Hono client (`hc<CloudBillingAPI>`). */
export type CloudBillingSchema = JSONRoute<
  'get',
  typeof CLOUD_BILLING_API_PATHS.catalog,
  BlankInput,
  BillingCatalog
> &
  JSONRoute<'get', typeof CLOUD_BILLING_API_PATHS.account, BlankInput, BillingAccount> &
  JSONRoute<
    'post',
    typeof CLOUD_BILLING_API_PATHS.checkout,
    { json: CheckoutRequest },
    BillingRedirect
  > &
  JSONRoute<'post', typeof CLOUD_BILLING_API_PATHS.portal, BlankInput, BillingRedirect>

export type CloudBillingAPI = Hono<BlankEnv, CloudBillingSchema>
