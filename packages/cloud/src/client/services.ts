import type { CloudFetch } from '#cloud/client/discovery'
import { serviceJSON } from '#cloud/client/response'
import {
  serviceCatalogSchema,
  serviceErrorSchema,
  creditWalletSchema,
  searchResponseSchema,
  CLOUD_SERVICES_API_PATHS,
  type ServiceCatalog,
  type ServiceErrorCode,
  type CreditWallet,
  type SearchRequestInput,
  type SearchResponse,
  type CloudServicesAPI
} from '#cloud/contract'
import { hc } from 'hono/client'
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
    const token = await tokens.token()
    const response = await send(input, init, token)
    if (response.status !== 401) return response
    tokens.invalidate(token)
    if (!replayable(input, init?.body)) return response
    return send(input, init, await tokens.token())
  }
}

const errorBodySchema = v.pipe(v.string(), v.parseJson(), serviceErrorSchema)

function refused(status: number, body: string): CloudServiceError {
  const error = v.safeParse(errorBodySchema, body)
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
  // Answers are parsed rather than trusted: the service is deployed apart from this client.
  const { v1 } = hc<CloudServicesAPI>(endpoint, { fetch })
  return {
    /** The base URL an OpenAI-compatible client sends chat completions below. */
    modelBaseURL: joinURL(endpoint, CLOUD_SERVICES_API_PATHS.base),
    fetch,
    async catalog(): Promise<ServiceCatalog> {
      return serviceJSON(await v1.catalog.$get(), serviceCatalogSchema, refused)
    },
    async wallet(): Promise<CreditWallet> {
      return serviceJSON(await v1.wallet.$get(), creditWalletSchema, refused)
    },
    /** A web search, charged to the workspace; only when the catalog lists `search`. */
    async search(input: SearchRequestInput): Promise<SearchResponse> {
      return serviceJSON(await v1.search.$post({ json: input }), searchResponseSchema, refused)
    }
  }
}

export type CloudServicesClient = ReturnType<typeof createCloudServicesClient>
