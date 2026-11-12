import * as v from 'valibot'

import type { PKCE } from '../sign-in/pkce'

/** OpenRouter's OAuth PKCE flow: https://openrouter.ai/docs/guides/overview/auth/oauth */
export const OPENROUTER_AUTH_URL = 'https://openrouter.ai/auth'
export const OPENROUTER_KEYS_URL = 'https://openrouter.ai/api/v1/auth/keys'
/** Authorization codes expire after ten minutes. */
export const OPENROUTER_CODE_LIFETIME_MS = 10 * 60 * 1000

export class OpenRouterKeyExchangeError extends Error {
  constructor(readonly status: number) {
    super(`OpenRouter key exchange failed with status ${status}`)
    this.name = 'OpenRouterKeyExchangeError'
  }
}

export function openRouterAuthorizationURL(
  callbackURL: string,
  pkce: PKCE,
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
