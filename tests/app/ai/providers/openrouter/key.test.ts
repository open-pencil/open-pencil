import { describe, expect, test } from 'bun:test'

import {
  fetchOpenRouterKeyInfo,
  OPENROUTER_KEY_INFO_URL,
  OpenRouterKeyError
} from '@/app/ai/providers/openrouter/key'

import { fetchStub } from '#tests/helpers/fetch'

describe('fetchOpenRouterKeyInfo', () => {
  test('reports the key label and free tier with the key as a bearer token', async () => {
    const requests: { url: string; authorization: string | null }[] = []
    const fetchImpl = fetchStub(async (input, init) => {
      const url = String(input)
      requests.push({ url, authorization: new Headers(init?.headers).get('authorization') })
      return Response.json({ data: { label: 'OpenPencil', is_free_tier: true, usage: 0 } })
    })
    expect(await fetchOpenRouterKeyInfo('sk-or-v1-test', fetchImpl)).toEqual({
      label: 'OpenPencil',
      freeTier: true
    })
    expect(requests).toEqual([
      { url: OPENROUTER_KEY_INFO_URL, authorization: 'Bearer sk-or-v1-test' }
    ])
  })

  test('rejects a key OpenRouter does not accept', async () => {
    const rejected = fetchStub(async () =>
      Response.json({ error: { code: 401, message: 'Invalid credentials' } }, { status: 401 })
    )
    await expect(fetchOpenRouterKeyInfo('sk-or-bad', rejected)).rejects.toBeInstanceOf(
      OpenRouterKeyError
    )
  })
})
