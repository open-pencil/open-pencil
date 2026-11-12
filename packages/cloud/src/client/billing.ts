import type { CloudFetch } from '#cloud/client/discovery'
import { cloudServicesFetch, type CloudServicesTokenSource } from '#cloud/client/services'
import {
  billingAccountSchema,
  billingCatalogSchema,
  billingErrorSchema,
  billingRedirectSchema,
  type BillingAccount,
  type BillingCatalog,
  type BillingErrorCode,
  type CheckoutRequest,
  type CloudBillingAPI
} from '#cloud/contract'
import { hc } from 'hono/client'
import { withoutTrailingSlash } from 'ufo'
import * as v from 'valibot'

export class CloudBillingError extends Error {
  override readonly name = 'CloudBillingError'

  constructor(
    readonly status: number,
    readonly code?: BillingErrorCode
  ) {
    super(`OpenPencil billing request failed with HTTP ${status}`)
  }
}

const errorBodySchema = v.pipe(v.string(), v.parseJson(), billingErrorSchema)

async function parsed<TSchema extends v.GenericSchema>(
  response: Pick<Response, 'ok' | 'status' | 'text'>,
  schema: TSchema
): Promise<v.InferOutput<TSchema>> {
  const text = await response.text()
  if (!response.ok) {
    const error = v.safeParse(errorBodySchema, text)
    throw new CloudBillingError(
      response.status,
      error.success ? error.output.error.code : undefined
    )
  }
  return v.parse(v.pipe(v.string(), v.parseJson(), schema), text)
}

export type CloudBillingClientOptions = {
  /** The billing service's endpoint, as Cloud's discovery names it. */
  endpoint: string
  /** Billing tokens for the signed-in person, from `requestBillingToken`. */
  tokens: CloudServicesTokenSource
  fetch: CloudFetch
}

/**
 * The billing a Cloud advertises: what it sells, the account's subscription, and where to buy or
 * manage it. Checkout and the portal answer with the payment provider's page to open, so a token
 * never travels in a URL.
 */
export function createCloudBillingClient(options: CloudBillingClientOptions) {
  const endpoint = withoutTrailingSlash(options.endpoint)
  // Answers are parsed rather than trusted: the service is deployed apart from this client.
  const { v1 } = hc<CloudBillingAPI>(endpoint, {
    fetch: cloudServicesFetch(options.tokens, options.fetch)
  })
  return {
    async catalog(): Promise<BillingCatalog> {
      return parsed(await v1.catalog.$get(), billingCatalogSchema)
    },
    async account(): Promise<BillingAccount> {
      return parsed(await v1.account.$get(), billingAccountSchema)
    },
    /** The checkout page that buys `request` for the account. */
    async checkout(request: CheckoutRequest): Promise<string> {
      return (await parsed(await v1.checkout.$post({ json: request }), billingRedirectSchema)).url
    },
    /** The page where the account cancels, changes its card, and reads its invoices. */
    async portal(): Promise<string> {
      return (await parsed(await v1.portal.$post(), billingRedirectSchema)).url
    }
  }
}

export type CloudBillingClient = ReturnType<typeof createCloudBillingClient>
