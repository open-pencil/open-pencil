import { describe, expect, test } from 'bun:test'

import {
  CloudServiceError,
  cloudServicesFetch,
  createCloudServicesClient,
  createCloudAPIClient
} from '#cloud/client'
import { CLOUD_SERVICES_API_PATHS } from '#cloud/contract'

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
    expect(await client.requestServicesToken(workspaceId)).toEqual({
      token: 'signed',
      expiresAt: '2026-10-21T12:10:00.000Z'
    })
    expect(requests[0]?.url).toBe('https://cloud.example.com/api/services/token')
    expect(requests[0]?.method).toBe('POST')
    expect(await requests[0]?.json()).toEqual({ workspaceId })
  })

  test('sends the token, and once more with a new one when the service refuses it', async () => {
    const authorizations: (string | null)[] = []
    const issued = tokens('stale', 'fresh')
    const client = createCloudServicesClient({
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
    expect(client.modelBaseURL).toBe(`https://ai.example.com${CLOUD_SERVICES_API_PATHS.base}`)
    expect(await client.catalog()).toEqual(catalog)
    expect(authorizations).toEqual(['Bearer stale', 'Bearer fresh'])
    expect(issued.invalidated).toEqual(['stale'])
  })

  test('reports the service error code, and retries a refused token only once', async () => {
    const credits = createCloudServicesClient({
      endpoint: 'https://ai.example.com',
      tokens: tokens('token').source,
      fetch: async () => Response.json({ error: { code: 'insufficient_credits' } }, { status: 402 })
    })
    const failure = await credits.wallet().catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(CloudServiceError)
    expect(failure).toMatchObject({ status: 402, code: 'insufficient_credits' })

    let calls = 0
    const refused = createCloudServicesClient({
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

  test('searches with a JSON body and reads the results', async () => {
    const requests: Request[] = []
    const results = [
      {
        url: 'https://example.com/grids',
        title: 'Grids',
        publishedAt: null,
        author: null,
        text: 'Columns and gutters.'
      }
    ]
    const client = createCloudServicesClient({
      endpoint: 'https://services.example.com',
      tokens: tokens('token').source,
      fetch: async (input, init) => {
        requests.push(new Request(input, init))
        return Response.json({ results })
      }
    })
    expect(await client.search({ query: 'grids', numResults: 3 })).toEqual({ results })
    expect(requests[0]?.url).toBe(`https://services.example.com${CLOUD_SERVICES_API_PATHS.search}`)
    expect(requests[0]?.method).toBe('POST')
    expect(await requests[0]?.json()).toEqual({ query: 'grids', numResults: 3 })
  })

  test('does not resend a body it cannot replay', async () => {
    let calls = 0
    const fetch = cloudServicesFetch(tokens('one', 'two', 'three').source, async () => {
      calls++
      return new Response(null, { status: 401 })
    })
    const body = new ReadableStream({
      start(controller) {
        controller.close()
      }
    })
    expect(
      (await fetch('https://ai.example.com/v1/chat/completions', { method: 'POST', body })).status
    ).toBe(401)
    expect(calls).toBe(1)
    expect(
      (await fetch('https://ai.example.com/v1/chat/completions', { method: 'POST', body: '{}' }))
        .status
    ).toBe(401)
    expect(calls).toBe(3)
  })
})
