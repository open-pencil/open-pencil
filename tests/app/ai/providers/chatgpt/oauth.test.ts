import { describe, expect, test } from 'bun:test'

import {
  chatGPTAccount,
  chatGPTAuthorizationURL,
  ChatGPTTokenError,
  CHATGPT_TOKEN_URL,
  exchangeChatGPTCode,
  refreshChatGPTCredential
} from '@/app/ai/providers/chatgpt/oauth'

import { accessToken, idToken, jwt, tokenResponse } from '#tests/helpers/ai/chatgpt'

describe('ChatGPT OAuth', () => {
  test('builds the Codex authorization URL with the challenge and state', () => {
    const url = new URL(chatGPTAuthorizationURL({ verifier: 'v', challenge: 'c', state: 's' }))
    expect(url.origin + url.pathname).toBe('https://auth.openai.com/oauth/authorize')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'app_EMoamEEZ73f0CkXaXp7hrann',
      redirect_uri: 'http://localhost:1455/auth/callback',
      scope: 'openid profile email offline_access',
      code_challenge: 'c',
      code_challenge_method: 'S256',
      state: 's',
      id_token_add_organizations: 'true',
      codex_cli_simplified_flow: 'true',
      originator: 'open-pencil'
    })
  })

  test('reads the account from the access token and the email and plan from the ID token', () => {
    expect(chatGPTAccount(accessToken, idToken)).toEqual({
      accountId: 'acct-1',
      email: 'person@example.com',
      plan: 'plus'
    })
    expect(chatGPTAccount(accessToken)).toEqual({
      accountId: 'acct-1',
      email: undefined,
      plan: undefined
    })
  })

  test('rejects tokens that name no account', () => {
    expect(chatGPTAccount(jwt({ sub: 'x' }))).toBeNull()
    expect(chatGPTAccount('not-a-token')).toBeNull()
    expect(chatGPTAccount('a.!!!.c')).toBeNull()
  })

  test('exchanges the code as a form post and keeps the account', async () => {
    const requests: { url: string; body: string }[] = []
    const credential = await exchangeChatGPTCode('code-1', 'verifier-1', async (input, init) => {
      requests.push({ url: String(input), body: String(init?.body) })
      return tokenResponse({
        access_token: accessToken,
        refresh_token: 'refresh-1',
        expires_in: 3600,
        id_token: idToken
      })
    })
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe(CHATGPT_TOKEN_URL)
    expect(Object.fromEntries(new URLSearchParams(requests[0]?.body))).toEqual({
      client_id: 'app_EMoamEEZ73f0CkXaXp7hrann',
      grant_type: 'authorization_code',
      code: 'code-1',
      code_verifier: 'verifier-1',
      redirect_uri: 'http://localhost:1455/auth/callback'
    })
    expect(credential).toMatchObject({
      access: accessToken,
      refresh: 'refresh-1',
      accountId: 'acct-1',
      email: 'person@example.com',
      plan: 'plus'
    })
    expect(credential.expires).toBeGreaterThan(Date.now() + 3_500_000)
  })

  test('keeps the known email and plan when a refresh returns no ID token', async () => {
    let body = ''
    const refreshed = await refreshChatGPTCredential(
      {
        access: 'old',
        refresh: 'refresh-1',
        expires: 0,
        accountId: 'acct-1',
        email: 'person@example.com',
        plan: 'plus'
      },
      async (_input, init) => {
        body = String(init?.body)
        return tokenResponse({
          access_token: accessToken,
          refresh_token: 'refresh-2',
          expires_in: 60
        })
      }
    )
    expect(Object.fromEntries(new URLSearchParams(body))).toEqual({
      client_id: 'app_EMoamEEZ73f0CkXaXp7hrann',
      grant_type: 'refresh_token',
      refresh_token: 'refresh-1'
    })
    expect(refreshed).toMatchObject({
      refresh: 'refresh-2',
      email: 'person@example.com',
      plan: 'plus'
    })
  })

  test('fails on a rejected or malformed token response', async () => {
    const rejected = exchangeChatGPTCode('c', 'v', async () => new Response('', { status: 400 }))
    await expect(rejected).rejects.toBeInstanceOf(ChatGPTTokenError)
    const malformed = exchangeChatGPTCode('c', 'v', async () => tokenResponse({ access_token: 1 }))
    await expect(malformed).rejects.toBeInstanceOf(ChatGPTTokenError)
  })
})
