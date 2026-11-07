import * as v from 'valibot'

/**
 * The contract between editors, Cloud, and the services Cloud advertises: AI models today, and
 * other paid capabilities such as image generation and search as they arrive. Cloud only
 * advertises the service and signs short-lived tokens for it; the service, official or
 * self-hosted, calls the providers and keeps the credit wallet. It is versioned apart from the
 * Cloud protocol so a service can change without a Cloud release.
 */
export const CLOUD_SERVICES_CONTRACT_VERSION = '1' as const
/** The `aud` of every token Cloud signs for its services. */
export const CLOUD_SERVICES_TOKEN_AUDIENCE = 'openpencil-services' as const
/** Where Cloud publishes the public keys a service verifies its tokens with. */
export const CLOUD_SERVICES_JWKS_PATH = '/.well-known/jwks.json' as const

/**
 * Where a service answers, below the discovered `endpoint`. Model requests follow the OpenAI chat
 * completions API, so an OpenAI-compatible client takes `${endpoint}${base}` as its base URL.
 */
export const CLOUD_SERVICES_API_PATHS = {
  base: '/v1',
  chatCompletions: '/v1/chat/completions',
  catalog: '/v1/catalog',
  wallet: '/v1/wallet',
  usage: '/v1/usage'
} as const

const urlSchema = v.pipe(v.string(), v.url())
const creditsSchema = v.pipe(v.number(), v.integer(), v.minValue(0))

export const cloudServicesDiscoverySchema = v.object({
  endpoint: urlSchema,
  contractVersion: v.literal(CLOUD_SERVICES_CONTRACT_VERSION)
})
export type CloudServicesDiscovery = v.InferOutput<typeof cloudServicesDiscoverySchema>

export const cloudBillingDiscoverySchema = v.object({ portalURL: urlSchema })
export type CloudBillingDiscovery = v.InferOutput<typeof cloudBillingDiscoverySchema>

export const createServicesTokenSchema = v.object({ workspaceId: v.pipe(v.string(), v.uuid()) })
export type CreateServicesTokenInput = v.InferOutput<typeof createServicesTokenSchema>

export function parseCreateServicesToken(input: unknown): CreateServicesTokenInput {
  return v.parse(createServicesTokenSchema, input)
}

export const servicesTokenSchema = v.object({
  token: v.pipe(v.string(), v.minLength(1)),
  expiresAt: v.pipe(v.string(), v.isoTimestamp())
})
export type ServicesToken = v.InferOutput<typeof servicesTokenSchema>

/** What a service may rely on once a token's signature, issuer, audience, and expiry check. */
export const servicesTokenClaimsSchema = v.object({
  iss: urlSchema,
  aud: v.literal(CLOUD_SERVICES_TOKEN_AUDIENCE),
  sub: v.pipe(v.string(), v.minLength(1)),
  workspaceId: v.pipe(v.string(), v.uuid()),
  /**
   * The account whose credits the request spends: the workspace's owner, whose allowance every
   * workspace they own shares.
   */
  accountId: v.pipe(v.string(), v.minLength(1)),
  /** Credits the owner's plan grants each month; `null` when Cloud sets no allowance. */
  monthlyCreditAllowance: v.nullable(creditsSchema),
  iat: v.pipe(v.number(), v.integer()),
  exp: v.pipe(v.number(), v.integer())
})
export type ServicesTokenClaims = v.InferOutput<typeof servicesTokenClaimsSchema>

export const chatModelSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  label: v.pipe(v.string(), v.minLength(1)),
  /** Credits per million input and output tokens. */
  creditsPerMillionInputTokens: creditsSchema,
  creditsPerMillionOutputTokens: creditsSchema,
  contextTokens: v.pipe(v.number(), v.integer(), v.minValue(1)),
  capabilities: v.object({ reasoning: v.boolean(), vision: v.boolean(), tools: v.boolean() })
})
export type ChatModel = v.InferOutput<typeof chatModelSchema>

export const serviceCatalogSchema = v.object({
  models: v.array(chatModelSchema),
  defaultModelID: v.pipe(v.string(), v.minLength(1))
})
export type ServiceCatalog = v.InferOutput<typeof serviceCatalogSchema>

export const creditBucketSchema = v.object({
  kind: v.picklist(['allowance', 'purchased', 'grant']),
  remaining: creditsSchema,
  expiresAt: v.nullable(v.pipe(v.string(), v.isoTimestamp()))
})
export type CreditBucket = v.InferOutput<typeof creditBucketSchema>

/**
 * A service records a request's charge before the request's answer ends, so a wallet read after
 * an answer includes what it cost.
 */
export const creditWalletSchema = v.object({
  /** Credits left to spend; `null` when the service sets no limit. */
  balance: v.nullable(creditsSchema),
  /** Spent first to last. */
  buckets: v.array(creditBucketSchema)
})
export type CreditWallet = v.InferOutput<typeof creditWalletSchema>

export const usageEntrySchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  kind: v.picklist(['model', 'image', 'search']),
  modelID: v.nullable(v.string()),
  userId: v.pipe(v.string(), v.minLength(1)),
  credits: creditsSchema
})
export type UsageEntry = v.InferOutput<typeof usageEntrySchema>

export const usageQuerySchema = v.object({
  cursor: v.optional(v.pipe(v.string(), v.minLength(1)))
})
export type UsageQuery = v.InferOutput<typeof usageQuerySchema>

export function parseUsageQuery(input: unknown): UsageQuery {
  return v.parse(usageQuerySchema, input)
}

export const usagePageSchema = v.object({
  entries: v.array(usageEntrySchema),
  next: v.nullable(v.string())
})
export type UsagePage = v.InferOutput<typeof usagePageSchema>

/** Errors a service answers with, beside the upstream provider's own. */
export const serviceErrorCodeSchema = v.picklist([
  'unauthorized',
  'insufficient_credits',
  'model_not_allowed',
  'rate_limited'
])
export type ServiceErrorCode = v.InferOutput<typeof serviceErrorCodeSchema>

export const serviceErrorSchema = v.object({
  error: v.object({
    code: serviceErrorCodeSchema,
    message: v.optional(v.string()),
    /** With `insufficient_credits`: when the workspace's allowance renews, if the service knows. */
    resetsAt: v.optional(v.pipe(v.string(), v.isoTimestamp()))
  })
})
export type ServiceError = v.InferOutput<typeof serviceErrorSchema>

export const SERVICE_ERROR_STATUS = {
  unauthorized: 401,
  insufficient_credits: 402,
  model_not_allowed: 403,
  rate_limited: 429
} as const satisfies Record<ServiceErrorCode, number>
