import { describe, expect, test } from 'bun:test'

import type { ChatGPTCredential } from '@/app/ai/providers/chatgpt/credential'
import {
  ChatGPTSignInExpiredError,
  codexRequestBody,
  completedResponse,
  createCodexFetch
} from '@/app/ai/providers/chatgpt/fetch'
import { CHATGPT_TOKEN_URL, ChatGPTTokenError } from '@/app/ai/providers/chatgpt/oauth'

import { accessToken, credential, tokenResponse } from '#tests/helpers/ai/chatgpt'

const RESPONSES_URL = 'https://chatgpt.com/backend-api/codex/responses'

interface Sent {
  url: string
  headers: Headers
  body: string
}

/** Answers token refreshes with a new pair and every other request with `answer`. */
function backend(answer: (sent: Sent) => Response) {
  const sent: Sent[] = []
  const refreshes: string[] = []
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const body = typeof init?.body === 'string' ? init.body : ''
    if (url === CHATGPT_TOKEN_URL) {
      refreshes.push(new URLSearchParams(body).get('refresh_token') ?? '')
      return tokenResponse({
        access_token: accessToken,
        refresh_token: `refresh-${refreshes.length + 1}`,
        expires_in: 3600
      })
    }
    const request = { url, headers: new Headers(init?.headers), body }
    sent.push(request)
    return answer(request)
  }
  return { sent, refreshes, fetchImpl }
}

const ok = () => new Response('data: {}\n\n', { headers: { 'content-type': 'text/event-stream' } })

function streamingRequest(fetch: ReturnType<typeof createCodexFetch>, extra = {}) {
  return fetch(RESPONSES_URL, {
    method: 'POST',
    headers: { authorization: 'Bearer chatgpt' },
    body: JSON.stringify({ model: 'gpt-6-luna', stream: true, input: [], ...extra })
  })
}

describe('Codex request body', () => {
  test('streams without storing, keeps reasoning, and moves tools into a developer item', () => {
    const tool = { type: 'function', name: 'set_fill', parameters: {} }
    const body = codexRequestBody(
      {
        model: 'gpt-6-luna',
        stream: false,
        max_output_tokens: 1,
        reasoning: { effort: 'low' },
        tools: [tool],
        input: [
          { role: 'system', content: 'Be terse.' },
          { role: 'user', content: [{ type: 'input_text', text: 'Hi' }] }
        ]
      },
      'cache-1'
    )
    expect(body).toEqual({
      model: 'gpt-6-luna',
      stream: true,
      store: false,
      include: ['reasoning.encrypted_content'],
      prompt_cache_key: 'cache-1',
      parallel_tool_calls: false,
      reasoning: { effort: 'low', context: 'all_turns' },
      input: [
        {
          type: 'additional_tools',
          role: 'developer',
          tools: [{ type: 'namespace', name: 'functions', description: '', tools: [tool] }]
        },
        { role: 'developer', content: 'Be terse.' },
        { role: 'user', content: [{ type: 'input_text', text: 'Hi' }] }
      ]
    })
  })

  test('adds no tool item when the request has no tools', () => {
    const body = codexRequestBody({ include: ['reasoning.encrypted_content'], input: [] })
    expect(body.input).toEqual([])
    expect(body.include).toEqual(['reasoning.encrypted_content'])
    expect(body).not.toHaveProperty('prompt_cache_key')
  })

  test('collapses an event stream into its completed response', () => {
    const stream = [
      'event: response.created',
      'data: {"type":"response.created"}',
      '',
      'data: not json',
      'data: {"type":"response.completed","response":{"id":"r1","output":[]}}',
      ''
    ].join('\n')
    expect(completedResponse(stream)).toEqual({ id: 'r1', output: [] })
    expect(completedResponse('data: {"type":"response.created"}\n')).toBeUndefined()
  })
})

describe('Codex fetch', () => {
  test('signs Responses requests with the account and the Codex headers', async () => {
    const server = backend(ok)
    await streamingRequest(createCodexFetch({ credential: credential(), fetch: server.fetchImpl }))
    const headers = server.sent[0]?.headers
    expect(headers?.get('authorization')).toBe('Bearer access-1')
    expect(headers?.get('chatgpt-account-id')).toBe('acct-1')
    expect(headers?.get('originator')).toBe('open-pencil')
    expect(headers?.get('openai-beta')).toBe('responses=experimental')
    expect(headers?.get('x-openai-internal-codex-responses-lite')).toBe('true')
    expect(server.refreshes).toEqual([])
  })

  test('signs other requests without the Responses headers', async () => {
    const server = backend(() => new Response('{"models":[]}'))
    const fetch = createCodexFetch({ credential: credential(), fetch: server.fetchImpl })
    await fetch('https://chatgpt.com/backend-api/codex/models?client_version=1')
    const headers = server.sent[0]?.headers
    expect(headers?.get('authorization')).toBe('Bearer access-1')
    expect(headers?.get('accept')).toBeNull()
    expect(headers?.get('x-openai-internal-codex-responses-lite')).toBeNull()
  })

  test('answers a non-streaming caller with the completed response', async () => {
    const server = backend(
      () =>
        new Response('data: {"type":"response.completed","response":{"id":"r1"}}\n\n', {
          headers: { 'content-type': 'text/event-stream' }
        })
    )
    const fetch = createCodexFetch({ credential: credential(), fetch: server.fetchImpl })
    const response = await streamingRequest(fetch, { stream: false })
    expect(JSON.parse(server.sent[0]?.body ?? '{}')).toMatchObject({ stream: true })
    expect(await response.json()).toEqual({ id: 'r1' })
  })

  test('refreshes a sign-in about to expire and saves the new tokens first', async () => {
    const saved: ChatGPTCredential[] = []
    const server = backend(ok)
    const fetch = createCodexFetch({
      credential: credential({ expires: Date.now() + 1000 }),
      fetch: server.fetchImpl,
      save: async (next) => {
        saved.push(next)
      }
    })
    await streamingRequest(fetch)
    expect(server.refreshes).toEqual(['refresh-1'])
    expect(saved.map((next) => next.refresh)).toEqual(['refresh-2'])
    expect(server.sent[0]?.headers.get('authorization')).toBe(`Bearer ${accessToken}`)
  })

  test('refreshes once and retries when the backend rejects the token', async () => {
    const server = backend((sent) =>
      sent.headers.get('authorization') === 'Bearer access-1'
        ? new Response('', { status: 401 })
        : ok()
    )
    const fetch = createCodexFetch({ credential: credential(), fetch: server.fetchImpl })
    const response = await streamingRequest(fetch)
    expect(response.status).toBe(200)
    expect(server.refreshes).toEqual(['refresh-1'])
    expect(server.sent).toHaveLength(2)
  })

  test('spends a refresh token once when models sharing a sign-in refresh together', async () => {
    const server = backend(ok)
    const stale = credential({ refresh: 'shared-refresh', expires: 0 })
    const first = createCodexFetch({ credential: stale, fetch: server.fetchImpl })
    const second = createCodexFetch({ credential: stale, fetch: server.fetchImpl })
    await Promise.all([streamingRequest(first), streamingRequest(second)])
    expect(server.refreshes).toEqual(['shared-refresh'])
  })

  test('takes a stored sign-in another model already refreshed', async () => {
    const server = backend(ok)
    const fetch = createCodexFetch({
      credential: credential({ expires: 0 }),
      fetch: server.fetchImpl,
      load: async () => credential({ access: 'access-2', refresh: 'refresh-2' })
    })
    await streamingRequest(fetch)
    expect(server.refreshes).toEqual([])
    expect(server.sent[0]?.headers.get('authorization')).toBe('Bearer access-2')
  })

  test('reports an expired sign-in when the refresh is refused', async () => {
    const fetch = createCodexFetch({
      credential: credential({ expires: 0 }),
      fetch: async () => new Response('', { status: 400 })
    })
    await expect(streamingRequest(fetch)).rejects.toBeInstanceOf(ChatGPTSignInExpiredError)
  })

  test('reports an expired sign-in only when the refresh token is refused', async () => {
    // The body auth.openai.com sends for an unknown refresh token.
    const revoked = createCodexFetch({
      credential: credential({ expires: 0, refresh: 'refresh-revoked' }),
      fetch: async () =>
        Response.json(
          { error: { type: 'invalid_request_error', code: 'invalid_refresh_token' } },
          { status: 401 }
        )
    })
    await expect(streamingRequest(revoked)).rejects.toBeInstanceOf(ChatGPTSignInExpiredError)

    const reused = createCodexFetch({
      credential: credential({ expires: 0, refresh: 'refresh-reused' }),
      fetch: async () => Response.json({ error: { code: 'refresh_token_reused' } }, { status: 400 })
    })
    await expect(streamingRequest(reused)).rejects.toBeInstanceOf(ChatGPTSignInExpiredError)

    const malformed = createCodexFetch({
      credential: credential({ expires: 0, refresh: 'refresh-malformed' }),
      fetch: async () => Response.json({ error: 'invalid_request' }, { status: 400 })
    })
    await expect(streamingRequest(malformed)).rejects.toBeInstanceOf(ChatGPTTokenError)
  })

  test('keeps the sign-in when the auth server fails to refresh it', async () => {
    const fetch = createCodexFetch({
      credential: credential({ expires: 0, refresh: 'refresh-busy' }),
      fetch: async () => new Response('', { status: 503 })
    })
    await expect(streamingRequest(fetch)).rejects.toBeInstanceOf(ChatGPTTokenError)
  })
})
