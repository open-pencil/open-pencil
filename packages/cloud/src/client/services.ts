import { createContractClient } from '#cloud/client/contract'
import type { CloudFetch } from '#cloud/client/discovery'
import {
  serviceErrorSchema,
  servicesContract,
  CLOUD_SERVICES_API_PATHS,
  sendsTokenSafely,
  type ServiceCatalog,
  type ServiceErrorCode,
  type CreditWallet,
  type SearchRequestInput,
  type SearchResponse
} from '#cloud/contract'
import { joinURL, withoutTrailingSlash } from 'ufo'
import * as v from 'valibot'

/** Where a request gets the token it sends, and how it drops one the service refused. */
export type CloudServicesTokenSource = {
  token(): Promise<string>
  /** Forgets `token`, so the next call signs a new one. */
  invalidate(token: string): void
}

export class CloudServiceError extends Error {
  override readonly name = 'CloudServiceError'

  constructor(
    readonly status: number,
    readonly code?: ServiceErrorCode
  ) {
    super(`OpenPencil services request failed with HTTP ${status}`)
  }
}

/** A service endpoint a token would reach in the clear, which no request is sent to. */
export class CloudServiceInsecureEndpointError extends Error {
  override readonly name = 'CloudServiceInsecureEndpointError'

  constructor(readonly url: string) {
    super('OpenPencil services and billing are reached only over HTTPS')
  }
}

/** Whether a request can be sent twice: a stream, in `init` or a `Request`, is read by the first. */
function replayable(input: RequestInfo | URL, body: RequestInit['body']): boolean {
  if (input instanceof Request && input.body) return false
  return !(body instanceof ReadableStream)
}

/**
 * Sends each request with a current token. A token the service refuses, for instance one signed
 * by a key Cloud has since replaced, is dropped and a request that can be replayed is sent once
 * more with a new one.
 */
export function cloudServicesFetch(
  tokens: CloudServicesTokenSource,
  fetch: CloudFetch
): CloudFetch {
  const send = async (input: RequestInfo | URL, init: RequestInit | undefined, token: string) => {
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${token}`)
    return fetch(input, { ...init, headers })
  }
  return async (input, init) => {
    const url = input instanceof Request ? input.url : input
    // Refused before a token is even signed, so none is sent where the network could read it.
    if (!sendsTokenSafely(url)) throw new CloudServiceInsecureEndpointError(String(url))
    const token = await tokens.token()
    const response = await send(input, init, token)
    if (response.status !== 401) return response
    tokens.invalidate(token)
    if (!replayable(input, init?.body)) return response
    return send(input, init, await tokens.token())
  }
}

function refused(status: number, body: unknown): CloudServiceError {
  const error = v.safeParse(serviceErrorSchema, body)
  return new CloudServiceError(status, error.success ? error.output.error.code : undefined)
}

export type CloudServicesClientOptions = {
  /** The service's endpoint, as Cloud's discovery names it. */
  endpoint: string
  tokens: CloudServicesTokenSource
  fetch: CloudFetch
}

/** The services a Cloud advertises: the model API base URL, catalog, wallet, and search. */
export function createCloudServicesClient(options: CloudServicesClientOptions) {
  const endpoint = withoutTrailingSlash(options.endpoint)
  const fetch = cloudServicesFetch(options.tokens, options.fetch)
  // Answers are checked against the contract rather than trusted: the service is deployed apart
  // from this client, and takes no cookies, only the token.
  const service = createContractClient(servicesContract, endpoint, {
    fetch,
    headers: {},
    credentials: 'omit',
    refusal: refused
  })
  return {
    /** The base URL an OpenAI-compatible client sends chat completions below. */
    modelBaseURL: joinURL(endpoint, CLOUD_SERVICES_API_PATHS.base),
    fetch,
    catalog(): Promise<ServiceCatalog> {
      return service.catalog()
    },
    wallet(): Promise<CreditWallet> {
      return service.wallet()
    },
    /** A web search, charged to the workspace; only when the catalog lists `search`. */
    search(input: SearchRequestInput): Promise<SearchResponse> {
      return service.search({ body: input })
    }
  }
}

export type CloudServicesClient = ReturnType<typeof createCloudServicesClient>
