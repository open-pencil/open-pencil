import { uniq } from 'es-toolkit/array'
import { omit } from 'es-toolkit/object'
import * as v from 'valibot'

import type { FetchFunction } from '@/app/http/types'

import type { ChatGPTCredential } from './credential'
import { CHATGPT_ORIGINATOR, ChatGPTTokenError, refreshChatGPTCredential } from './oauth'

/** The Codex backend serves the Responses API to ChatGPT accounts. */
export const CHATGPT_CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex'
/** Refreshes this long before the access token expires, so a request never carries a stale one. */
const REFRESH_MARGIN_MS = 60_000
const LITE_HEADER = 'x-openai-internal-codex-responses-lite'

export class ChatGPTSignInExpiredError extends Error {
  /** Read as an authentication failure, like a rejected API key. */
  readonly status = 401

  constructor() {
    super('The ChatGPT sign-in has expired. Sign in again from AI settings.')
    this.name = 'ChatGPTSignInExpiredError'
  }
}

export interface CodexFetchOptions {
  credential: ChatGPTCredential
  /** Reads the stored credential, which another model may have refreshed since this one began. */
  load?: () => Promise<ChatGPTCredential | null>
  /** Keeps a refreshed credential; OpenAI rotates refresh tokens, so losing one signs out. */
  save?: (credential: ChatGPTCredential) => Promise<void>
  fetch?: FetchFunction
  /** Groups one conversation's requests for the backend's prompt cache. */
  promptCacheKey?: string
}

/**
 * Refreshes in flight by refresh token. A refresh token works once, so models sharing a sign-in
 * join one refresh instead of spending it twice.
 */
const pendingRefreshes = new Map<string, Promise<ChatGPTCredential>>()

const REFUSED_STATUSES = new Set([400, 401, 403])
/** Codes that say the refresh token itself is spent, expired, or revoked. */
const REFUSED_CODES = new Set([
  'invalid_grant',
  'invalid_refresh_token',
  'refresh_token_expired',
  'refresh_token_reused',
  'refresh_token_invalidated'
])

/**
 * The token endpoint answers a bad refresh token with 401 and `invalid_refresh_token`; like the
 * Codex CLI, any 401 ends the sign-in. Other statuses end it only for a refusing code.
 */
function refusesSignIn(error: unknown): boolean {
  if (!(error instanceof ChatGPTTokenError)) return false
  if (error.status === 401) return true
  return error.code === undefined
    ? REFUSED_STATUSES.has(error.status)
    : REFUSED_CODES.has(error.code)
}

function isFresh(credential: ChatGPTCredential): boolean {
  return credential.expires - Date.now() >= REFRESH_MARGIN_MS
}

async function refreshAndSave(
  credential: ChatGPTCredential,
  fetchImpl: FetchFunction,
  save: CodexFetchOptions['save']
): Promise<ChatGPTCredential> {
  let refreshed: ChatGPTCredential
  try {
    refreshed = await refreshChatGPTCredential(credential, fetchImpl)
  } catch (error) {
    // Only a refused refresh ends the sign-in; a busy or failing auth server leaves it valid.
    throw refusesSignIn(error) ? new ChatGPTSignInExpiredError() : error
  }
  // The old refresh token is spent either way, so a failed save still uses the new pair.
  await save?.(refreshed).catch((error: unknown) => {
    console.warn('Could not save the refreshed ChatGPT sign-in:', error)
  })
  return refreshed
}

const requestBodySchema = v.looseObject({
  stream: v.optional(v.boolean()),
  input: v.optional(v.array(v.unknown())),
  tools: v.optional(v.array(v.unknown())),
  reasoning: v.optional(v.looseObject({})),
  include: v.optional(v.array(v.string()))
})
type RequestBody = v.InferOutput<typeof requestBodySchema>

const systemMessageSchema = v.looseObject({ role: v.literal('system') })

/**
 * Rewrites a Responses request the way Codex sends it. The backend only streams and keeps
 * nothing, so reasoning comes back encrypted for the next turn. Current models take the Lite
 * format, which moves tools into a developer item and runs one tool call at a time.
 */
export function codexRequestBody(body: RequestBody, promptCacheKey?: string): RequestBody {
  const input = (body.input ?? []).map((item) =>
    v.is(systemMessageSchema, item) ? { ...item, role: 'developer' } : item
  )
  // Codex never limits output; plans meter usage instead.
  const tools = body.tools
  return {
    ...omit(body, ['tools', 'max_output_tokens']),
    stream: true,
    store: false,
    include: uniq([...(body.include ?? []), 'reasoning.encrypted_content']),
    ...(promptCacheKey && { prompt_cache_key: promptCacheKey }),
    parallel_tool_calls: false,
    reasoning: { ...body.reasoning, context: 'all_turns' },
    input: tools?.length
      ? [
          {
            type: 'additional_tools',
            role: 'developer',
            tools: [{ type: 'namespace', name: 'functions', description: '', tools }]
          },
          ...input
        ]
      : input
  }
}

const streamEventSchema = v.looseObject({ type: v.string(), response: v.optional(v.unknown()) })

/** The final response of an event stream, for callers that asked for one JSON answer. */
export function completedResponse(stream: string): unknown {
  for (const line of stream.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const event = v.safeParse(v.pipe(v.string(), v.parseJson(), streamEventSchema), line.slice(6))
    if (event.success && event.output.type === 'response.completed') return event.output.response
  }
  return undefined
}

/**
 * A `fetch` for the AI SDK's OpenAI provider that signs requests with a ChatGPT account,
 * refreshes the sign-in when it is about to expire or is rejected, and speaks Codex's format.
 */
export function createCodexFetch(options: CodexFetchOptions): FetchFunction {
  const fetchImpl = options.fetch ?? fetch
  let credential = options.credential

  async function refresh(): Promise<void> {
    const stored = await options.load?.()
    if (stored && stored.refresh !== credential.refresh && isFresh(stored)) {
      credential = stored
      return
    }
    const token = credential.refresh
    let pending = pendingRefreshes.get(token)
    if (!pending) {
      pending = refreshAndSave(credential, fetchImpl, options.save).finally(() =>
        pendingRefreshes.delete(token)
      )
      pendingRefreshes.set(token, pending)
    }
    credential = await pending
  }

  function send(input: RequestInfo | URL, init: RequestInit, responses: boolean) {
    const headers = new Headers(init.headers)
    headers.set('authorization', `Bearer ${credential.access}`)
    headers.set('chatgpt-account-id', credential.accountId)
    headers.set('originator', CHATGPT_ORIGINATOR)
    if (responses) {
      headers.set('OpenAI-Beta', 'responses=experimental')
      headers.set('accept', 'text/event-stream')
      headers.set(LITE_HEADER, 'true')
    }
    return fetchImpl(input, { ...init, headers })
  }

  async function signed(input: RequestInfo | URL, init: RequestInit, responses: boolean) {
    if (!isFresh(credential)) await refresh()
    const response = await send(input, init, responses)
    if (response.status !== 401) return response
    await refresh()
    return send(input, init, responses)
  }

  return async (input, init = {}) => {
    const parsed = v.safeParse(
      v.pipe(v.string(), v.parseJson(), requestBodySchema),
      typeof init.body === 'string' ? init.body : ''
    )
    if (!parsed.success) return signed(input, init, false)
    const body = JSON.stringify(codexRequestBody(parsed.output, options.promptCacheKey))
    const response = await signed(input, { ...init, body }, true)
    if (!response.ok || parsed.output.stream === true) return response
    return new Response(JSON.stringify(completedResponse(await response.text()) ?? null), {
      status: response.status,
      headers: { 'content-type': 'application/json' }
    })
  }
}
