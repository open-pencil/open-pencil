import type { CloudFetch } from '#cloud/client/discovery'
import { serviceJSON } from '#cloud/client/response'
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

function refused(status: number, body: string): CloudBillingError {
  const error = v.safeParse(errorBodySchema, body)
  return new CloudBillingError(status, error.success ? error.output.error.code : undefined)
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
      return serviceJSON(await v1.catalog.$get(), billingCatalogSchema, refused)
    },
    async account(): Promise<BillingAccount> {
      return serviceJSON(await v1.account.$get(), billingAccountSchema, refused)
    },
    /** The checkout page that buys `request` for the account. */
    async checkout(request: CheckoutRequest): Promise<string> {
      return (
        await serviceJSON(
          await v1.checkout.$post({ json: request }),
          billingRedirectSchema,
          refused
        )
      ).url
    },
    /** The page where the account cancels, changes its card, and reads its invoices. */
    async portal(): Promise<string> {
      return (await serviceJSON(await v1.portal.$post(), billingRedirectSchema, refused)).url
    }
  }
}

export type CloudBillingClient = ReturnType<typeof createCloudBillingClient>
