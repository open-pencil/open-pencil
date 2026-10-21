import { describe, expect, test } from 'bun:test'

import { CloudAIError, createCloudAIClient, createCloudAPIClient } from '#cloud/client'
import { CLOUD_AI_API_PATHS } from '#cloud/contract'

const workspaceId = '11111111-1111-4111-8111-111111111111'
const catalog = {
  defaultModelID: 'model',
  models: [
    {
      id: 'model',
      label: 'Model',
      creditsPerMillionInputTokens: 1000,
      creditsPerMillionOutputTokens: 2000,
      contextTokens: 100_000,
      capabilities: { reasoning: false, vision: true, tools: true }
    }
  ]
}

function tokens(...issued: string[]) {
  const invalidated: string[] = []
  return {
    invalidated,
    source: {
      async token() {
        const token = issued[0]
        if (!token) throw new Error('No token left')
        return token
      },
      invalidate(token: string) {
        invalidated.push(token)
        if (issued[0] === token) issued.shift()
      }
    }
  }
}

describe('Cloud AI client', () => {
  test('signs a token for a workspace through the typed Cloud API', async () => {
    const requests: Request[] = []
    const client = createCloudAPIClient('https://cloud.example.com/api', {
      fetch: async (input, init) => {
        requests.push(new Request(input, init))
        return Response.json({ token: 'signed', expiresAt: '2026-10-21T12:10:00.000Z' })
      }
    })
    expect(await client.requestAIToken(workspaceId)).toEqual({
      token: 'signed',
      expiresAt: '2026-10-21T12:10:00.000Z'
    })
    expect(requests[0]?.url).toBe('https://cloud.example.com/api/ai/token')
    expect(requests[0]?.method).toBe('POST')
    expect(await requests[0]?.json()).toEqual({ workspaceId })
  })

  test('sends the token, and once more with a new one when the service refuses it', async () => {
    const authorizations: (string | null)[] = []
    const issued = tokens('stale', 'fresh')
    const client = createCloudAIClient({
      endpoint: 'https://ai.example.com/',
      tokens: issued.source,
      fetch: async (_input, init) => {
        const authorization = new Headers(init?.headers).get('Authorization')
        authorizations.push(authorization)
        return authorization === 'Bearer fresh'
          ? Response.json(catalog)
          : Response.json({ error: { code: 'unauthorized' } }, { status: 401 })
      }
    })
    expect(client.modelBaseURL).toBe(`https://ai.example.com${CLOUD_AI_API_PATHS.base}`)
    expect(await client.catalog()).toEqual(catalog)
    expect(authorizations).toEqual(['Bearer stale', 'Bearer fresh'])
    expect(issued.invalidated).toEqual(['stale'])
  })

  test('reports the service error code, and retries a refused token only once', async () => {
    const credits = createCloudAIClient({
      endpoint: 'https://ai.example.com',
      tokens: tokens('token').source,
      fetch: async () => Response.json({ error: { code: 'insufficient_credits' } }, { status: 402 })
    })
    const failure = await credits.wallet().catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(CloudAIError)
    expect(failure).toMatchObject({ status: 402, code: 'insufficient_credits' })

    let calls = 0
    const refused = createCloudAIClient({
      endpoint: 'https://ai.example.com',
      tokens: tokens('one', 'two', 'three').source,
      fetch: async () => {
        calls++
        return new Response('nope', { status: 401 })
      }
    })
    await expect(refused.catalog()).rejects.toMatchObject({ status: 401, code: undefined })
    expect(calls).toBe(2)
  })
})
