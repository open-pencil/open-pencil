import { fromUint8Array } from 'js-base64'
import * as v from 'valibot'

/** OpenRouter's OAuth PKCE flow: https://openrouter.ai/docs/guides/overview/auth/oauth */
export const OPENROUTER_AUTH_URL = 'https://openrouter.ai/auth'
export const OPENROUTER_KEYS_URL = 'https://openrouter.ai/api/v1/auth/keys'
/** Authorization codes expire after ten minutes. */
export const OPENROUTER_CODE_LIFETIME_MS = 10 * 60 * 1000

export interface OpenRouterPKCE {
  verifier: string
  challenge: string
  state: string
}

export type OpenRouterCallback =
  | { ok: true; code: string }
  | { ok: false; reason: 'cancelled' | 'mismatch' }

export class OpenRouterKeyExchangeError extends Error {
  constructor(readonly status: number) {
    super(`OpenRouter key exchange failed with status ${status}`)
    this.name = 'OpenRouterKeyExchangeError'
  }
}

function randomToken(bytes: number): string {
  return fromUint8Array(crypto.getRandomValues(new Uint8Array(bytes)), true)
}

/** The S256 challenge for a verifier: the base64url SHA-256 digest, without padding. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return fromUint8Array(new Uint8Array(digest), true)
}

export async function createOpenRouterPKCE(): Promise<OpenRouterPKCE> {
  const verifier = randomToken(48)
  return { verifier, challenge: await pkceChallenge(verifier), state: randomToken(16) }
}

export function openRouterAuthorizationURL(
  callbackURL: string,
  pkce: OpenRouterPKCE,
  keyLabel: string
): string {
  const url = new URL(OPENROUTER_AUTH_URL)
  url.searchParams.set('callback_url', callbackURL)
  url.searchParams.set('code_challenge', pkce.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', pkce.state)
  url.searchParams.set('key_label', keyLabel)
  return url.toString()
}

/** Reads the redirect OpenRouter sends back, rejecting one that belongs to another attempt. */
export function parseOpenRouterCallback(query: string, expectedState: string): OpenRouterCallback {
  const params = new URLSearchParams(query)
  if (params.get('state') !== expectedState) return { ok: false, reason: 'mismatch' }
  const code = params.get('code')
  return code ? { ok: true, code } : { ok: false, reason: 'cancelled' }
}

const keyExchangeSchema = v.object({ key: v.pipe(v.string(), v.minLength(1)) })

/** Trades an authorization code for an API key; OpenRouter allows this from a browser. */
export async function exchangeOpenRouterCode(
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const response = await fetchImpl(OPENROUTER_KEYS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' })
  })
  if (!response.ok) throw new OpenRouterKeyExchangeError(response.status)
  const parsed = v.safeParse(keyExchangeSchema, await response.json())
  if (!parsed.success) throw new OpenRouterKeyExchangeError(response.status)
  return parsed.output.key
}
