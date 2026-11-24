import type { RouterContract } from '@orpc/contract'
import { ResponseValidationLinkPlugin } from '@orpc/contract/plugins'
import { OpenAPILink } from '@orpc/openapi/fetch'

import { anySignal } from '@open-pencil/std/timing'

import type { ServiceContractClientOptions } from './contract'

/**
 * The link a contract's client sends requests through: the routes' paths at `baseURL`, answers
 * checked against the contract, and refusals read by `options.refusal`. Loaded with the first
 * request, so an editor that never calls Cloud never loads it.
 */
export function createContractLink(
  routes: RouterContract,
  baseURL: string,
  options: ServiceContractClientOptions
) {
  const url = new URL(baseURL)
  return new OpenAPILink(routes, {
    origin: url.origin,
    url: `/${url.pathname.replace(/^\/+/, '')}`,
    headers: options.headers,
    fetch: (request, init) =>
      options.fetch(request, {
        ...init,
        credentials: options.credentials,
        signal: anySignal([init.signal, options.signal])
      }),
    errorResponseBodyDecoder: (body, response) => options.refusal(response.status, body),
    plugins: [new ResponseValidationLinkPlugin(routes)]
  })
}
