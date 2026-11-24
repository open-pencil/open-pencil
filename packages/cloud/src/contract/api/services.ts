import { oc } from '@orpc/contract'
import * as v from 'valibot'

import {
  billingAccountSchema,
  billingCatalogSchema,
  billingRedirectSchema,
  checkoutRequestSchema,
  CLOUD_BILLING_API_PATHS
} from '../billing'
import {
  CLOUD_SERVICES_API_PATHS,
  creditWalletSchema,
  searchRequestSchema,
  searchResponseSchema,
  serviceCatalogSchema,
  usagePageSchema,
  usageQuerySchema
} from '../services'
import { at } from './route'

/**
 * Every route a service answers besides chat completions, which OpenAI-compatible clients call
 * themselves, below the service's discovered `endpoint`. Errors come as the service's own
 * `{ "error": { "code", "message" } }`, which `CloudServiceError` reads.
 */
export const servicesContract = {
  catalog: oc.meta(at('GET', CLOUD_SERVICES_API_PATHS.catalog)).output(serviceCatalogSchema),
  wallet: oc.meta(at('GET', CLOUD_SERVICES_API_PATHS.wallet)).output(creditWalletSchema),
  usage: oc
    .meta(at('GET', CLOUD_SERVICES_API_PATHS.usage))
    .input(v.object({ query: usageQuerySchema }))
    .output(usagePageSchema),
  search: oc
    .meta(at('POST', CLOUD_SERVICES_API_PATHS.search))
    .input(v.object({ body: searchRequestSchema }))
    .output(searchResponseSchema)
}

/** What the billing service answers below its discovered `endpoint`, for the account's own pages. */
export const billingContract = {
  catalog: oc.meta(at('GET', CLOUD_BILLING_API_PATHS.catalog)).output(billingCatalogSchema),
  account: oc.meta(at('GET', CLOUD_BILLING_API_PATHS.account)).output(billingAccountSchema),
  checkout: oc
    .meta(at('POST', CLOUD_BILLING_API_PATHS.checkout))
    .input(v.object({ body: checkoutRequestSchema }))
    .output(billingRedirectSchema),
  portal: oc.meta(at('POST', CLOUD_BILLING_API_PATHS.portal)).output(billingRedirectSchema)
}
