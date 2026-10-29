import type { CloudFetch } from '#cloud/client/discovery'
import {
  aiCatalogSchema,
  aiErrorSchema,
  aiWalletSchema,
  CLOUD_AI_API_PATHS,
  type AICatalog,
  type AIErrorCode,
  type AIWallet
} from '#cloud/contract'
import * as v from 'valibot'

/** Where a request gets the token it sends, and how it drops one the service refused. */
export type CloudAITokenSource = {
  token(): Promise<string>
  /** Forgets `token`, so the next call signs a new one. */
  invalidate(token: string): void
}

export class CloudAIError extends Error {
  override readonly name = 'CloudAIError'

  constructor(
    readonly status: number,
    readonly code?: AIErrorCode
  ) {
    super(`OpenPencil AI request failed with HTTP ${status}`)
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
export function cloudAIFetch(tokens: CloudAITokenSource, fetch: CloudFetch): CloudFetch {
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

const errorBodySchema = v.pipe(v.string(), v.parseJson(), aiErrorSchema)

async function parsed<TSchema extends v.GenericSchema>(
  response: Response,
  schema: TSchema
): Promise<v.InferOutput<TSchema>> {
  const text = await response.text()
  if (!response.ok) {
    const error = v.safeParse(errorBodySchema, text)
    throw new CloudAIError(response.status, error.success ? error.output.error.code : undefined)
  }
  return v.parse(v.pipe(v.string(), v.parseJson(), schema), text)
}

export type CloudAIClientOptions = {
  /** The service's endpoint, as Cloud's discovery names it. */
  endpoint: string
  tokens: CloudAITokenSource
  fetch: CloudFetch
}

/** The AI service a Cloud advertises: its model API base URL, catalog, and the wallet. */
export function createCloudAIClient(options: CloudAIClientOptions) {
  const endpoint = options.endpoint.replace(/\/+$/, '')
  const fetch = cloudAIFetch(options.tokens, options.fetch)
  return {
    /** The base URL an OpenAI-compatible client sends chat completions below. */
    modelBaseURL: `${endpoint}${CLOUD_AI_API_PATHS.base}`,
    fetch,
    async catalog(): Promise<AICatalog> {
      return parsed(await fetch(`${endpoint}${CLOUD_AI_API_PATHS.catalog}`), aiCatalogSchema)
    },
    async wallet(): Promise<AIWallet> {
      return parsed(await fetch(`${endpoint}${CLOUD_AI_API_PATHS.wallet}`), aiWalletSchema)
    }
  }
}

export type CloudAIClient = ReturnType<typeof createCloudAIClient>
