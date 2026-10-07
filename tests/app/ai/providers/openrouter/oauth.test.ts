import { describe, expect, test } from 'bun:test'

import {
  exchangeOpenRouterCode,
  openRouterAuthorizationURL,
  OpenRouterKeyExchangeError,
  OPENROUTER_KEYS_URL,
  parseOpenRouterCallback,
  pkceChallenge
} from '@/app/ai/providers/openrouter/oauth'

import { fetchStub } from '#tests/helpers/fetch'

describe('OpenRouter OAuth PKCE', () => {
  test('derives the S256 challenge from the RFC 7636 example verifier', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    )
  })

  test('builds the authorization URL with the challenge, state, and key label', () => {
    const url = new URL(
      openRouterAuthorizationURL(
        'http://localhost:4123/callback',
        { verifier: 'v', challenge: 'c', state: 's' },
        'OpenPencil'
      )
    )
    expect(url.origin + url.pathname).toBe('https://openrouter.ai/auth')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      callback_url: 'http://localhost:4123/callback',
      code_challenge: 'c',
      code_challenge_method: 'S256',
      state: 's',
      key_label: 'OpenPencil'
    })
  })

  test('accepts only the callback for the current attempt', () => {
    expect(parseOpenRouterCallback('?code=abc&state=s1', 's1')).toEqual({ ok: true, code: 'abc' })
    expect(parseOpenRouterCallback('?code=abc&state=other', 's1')).toEqual({
      ok: false,
      reason: 'mismatch'
    })
    expect(parseOpenRouterCallback('?state=s1', 's1')).toEqual({ ok: false, reason: 'cancelled' })
  })

  test('exchanges the code and verifier for a key', async () => {
    const requests: { url: string; body: unknown }[] = []
    const fetchImpl = fetchStub(async (input, init) => {
      const url = String(input)
      requests.push({ url, body: JSON.parse(String(init?.body)) })
      return Response.json({ key: 'sk-or-v1-test' })
    })
    expect(await exchangeOpenRouterCode('abc', 'verifier', fetchImpl)).toBe('sk-or-v1-test')
    expect(requests).toEqual([
      {
        url: OPENROUTER_KEYS_URL,
        body: { code: 'abc', code_verifier: 'verifier', code_challenge_method: 'S256' }
      }
    ])
  })

  test('reports a rejected or empty exchange', async () => {
    const rejected = fetchStub(async () =>
      Response.json({ error: { message: 'Invalid code' } }, { status: 400 })
    )
    await expect(exchangeOpenRouterCode('abc', 'v', rejected)).rejects.toBeInstanceOf(
      OpenRouterKeyExchangeError
    )
    const empty = fetchStub(async () => Response.json({}))
    await expect(exchangeOpenRouterCode('abc', 'v', empty)).rejects.toBeInstanceOf(
      OpenRouterKeyExchangeError
    )
  })
})
