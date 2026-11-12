import { decode, isValid } from 'js-base64'
import * as v from 'valibot'

import type { FetchFunction } from '@/app/http/types'

import type { PKCE } from '../sign-in/pkce'
import type { ChatGPTCredential } from './credential'

/**
 * ChatGPT sign-in is the OAuth PKCE flow the Codex CLI uses. OpenAI registers its client with
 * one redirect, a loopback listener on port 1455, so only the desktop app can receive it.
 */
export const CHATGPT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
export const CHATGPT_AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize'
export const CHATGPT_TOKEN_URL = 'https://auth.openai.com/oauth/token'
export const CHATGPT_CALLBACK_PORT = 1455
export const CHATGPT_CALLBACK_PATH = '/auth/callback'
export const CHATGPT_REDIRECT_URI = `http://localhost:${CHATGPT_CALLBACK_PORT}${CHATGPT_CALLBACK_PATH}`
/** Names this app to the backend in its `originator` header and on the consent screen. */
export const CHATGPT_ORIGINATOR = 'open-pencil'
const SCOPE = 'openid profile email offline_access'
/** The custom claim OpenAI puts its account details in. */
const AUTH_CLAIM = 'https://api.openai.com/auth'

export class ChatGPTTokenError extends Error {
  constructor(
    readonly status: number,
    /** The error code of an OAuth error body, such as `invalid_grant`. */
    readonly code?: string
  ) {
    super(`ChatGPT token request failed with status ${status}`)
    this.name = 'ChatGPTTokenError'
  }
}

export function chatGPTAuthorizationURL(pkce: PKCE): string {
  const url = new URL(CHATGPT_AUTHORIZE_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', CHATGPT_CLIENT_ID)
  url.searchParams.set('redirect_uri', CHATGPT_REDIRECT_URI)
  url.searchParams.set('scope', SCOPE)
  url.searchParams.set('code_challenge', pkce.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', pkce.state)
  url.searchParams.set('id_token_add_organizations', 'true')
  url.searchParams.set('codex_cli_simplified_flow', 'true')
  url.searchParams.set('originator', CHATGPT_ORIGINATOR)
  return url.toString()
}

const authClaimSchema = v.object({
  [AUTH_CLAIM]: v.looseObject({
    chatgpt_account_id: v.optional(v.string()),
    chatgpt_plan_type: v.optional(v.string())
  })
})
const idTokenSchema = v.looseObject({ email: v.optional(v.string()), ...authClaimSchema.entries })
const tokenResponseSchema = v.object({
  access_token: v.pipe(v.string(), v.minLength(1)),
  refresh_token: v.pipe(v.string(), v.minLength(1)),
  expires_in: v.pipe(v.number(), v.minValue(0)),
  id_token: v.optional(v.string())
})

/** A JWT's payload, unverified: the app only reads what its own token endpoint just returned. */
function jwtPayload(token: string): unknown {
  const payload = token.split('.')[1]
  if (!payload || !isValid(payload)) return null
  const parsed = v.safeParse(v.pipe(v.string(), v.parseJson()), decode(payload))
  return parsed.success ? parsed.output : null
}

type ChatGPTAccount = Pick<ChatGPTCredential, 'accountId' | 'email' | 'plan'>

/** Reads the account a token pair belongs to; the access token always names it. */
export function chatGPTAccount(accessToken: string, idToken?: string): ChatGPTAccount | null {
  const access = v.safeParse(authClaimSchema, jwtPayload(accessToken))
  const accountId = access.success ? access.output[AUTH_CLAIM].chatgpt_account_id : undefined
  if (!accountId) return null
  const id = idToken ? v.safeParse(idTokenSchema, jwtPayload(idToken)) : null
  return {
    accountId,
    email: id?.success ? id.output.email : undefined,
    plan: id?.success ? id.output[AUTH_CLAIM].chatgpt_plan_type : undefined
  }
}

// RFC 6749 sends `error` as a string; OpenAI's refresh errors nest it as `error.code`.
const oauthErrorBodySchema = v.object({
  error: v.union([v.string(), v.looseObject({ code: v.string() })])
})

async function oauthErrorCode(response: Response): Promise<string | undefined> {
  const parsed = v.safeParse(
    v.pipe(v.string(), v.parseJson(), oauthErrorBodySchema),
    await response.text().catch(() => '')
  )
  if (!parsed.success) return undefined
  const { error } = parsed.output
  return typeof error === 'string' ? error : error.code
}

async function requestTokens(
  body: Record<string, string>,
  fetchImpl: FetchFunction,
  previous?: ChatGPTAccount
): Promise<ChatGPTCredential> {
  const response = await fetchImpl(CHATGPT_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CHATGPT_CLIENT_ID, ...body }).toString()
  })
  if (!response.ok) throw new ChatGPTTokenError(response.status, await oauthErrorCode(response))
  const tokens = v.safeParse(tokenResponseSchema, await response.json())
  if (!tokens.success) throw new ChatGPTTokenError(response.status)
  const { access_token, refresh_token, expires_in, id_token } = tokens.output
  const account = chatGPTAccount(access_token, id_token)
  if (!account) throw new ChatGPTTokenError(response.status)
  return {
    access: access_token,
    refresh: refresh_token,
    expires: Date.now() + expires_in * 1000,
    accountId: account.accountId,
    email: account.email ?? previous?.email,
    plan: account.plan ?? previous?.plan
  }
}

export function exchangeChatGPTCode(
  code: string,
  verifier: string,
  fetchImpl: FetchFunction
): Promise<ChatGPTCredential> {
  return requestTokens(
    {
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: CHATGPT_REDIRECT_URI
    },
    fetchImpl
  )
}

/** Trades the refresh token for a new pair; OpenAI rotates the refresh token each time. */
export function refreshChatGPTCredential(
  credential: ChatGPTCredential,
  fetchImpl: FetchFunction
): Promise<ChatGPTCredential> {
  return requestTokens(
    { grant_type: 'refresh_token', refresh_token: credential.refresh },
    fetchImpl,
    credential
  )
}
