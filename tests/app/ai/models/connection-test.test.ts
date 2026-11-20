import { describe, expect, test } from 'bun:test'

import { createCloudServicesClient } from '@open-pencil/cloud/client'
import { isRecord } from '@open-pencil/std/records'

import { testProviderConnection } from '@/app/ai/models/connection-test'
import { cloudModelConfig } from '@/app/ai/providers/openpencil/model'

/** Tests a Cloud model whose service answers every request with `status` and `body`. */
function testCloudModel(status: number, body: unknown) {
  const client = createCloudServicesClient({
    endpoint: 'https://ai.example.com',
    tokens: { token: async () => 'cloud-token', invalidate: () => undefined },
    fetch: async () => Response.json(body, { status })
  })
  const { config, runtime } = cloudModelConfig(client, 'test/model', 'workspace-1')
  return testProviderConnection(config, runtime)
}

describe('testProviderConnection on Cloud’s AI service', () => {
  test('reports a workspace out of credits when the service refuses for that', async () => {
    expect(await testCloudModel(402, { error: { code: 'insufficient_credits' } })).toEqual({
      ok: false,
      reason: 'cloud-credits-exhausted'
    })
  })

  test('reports an upstream’s own 402, which the service passed through, as the provider’s', async () => {
    expect(
      await testCloudModel(402, { error: { code: 402, message: 'Insufficient credits' } })
    ).toEqual({ ok: false, reason: 'insufficient-credit' })
  })
})

describe('testProviderConnection on OpenAI', () => {
  test('asks for as many output tokens as OpenAI’s Responses API accepts', async () => {
    const asked: unknown[] = []
    const result = await testProviderConnection(
      {
        providerID: 'openai',
        apiKey: 'sk-test',
        modelID: 'gpt-test',
        customModelID: '',
        customBaseURL: '',
        customAPIType: 'responses'
      },
      {
        fetch: async (_input, init) => {
          const body: unknown = JSON.parse(String(init?.body))
          const tokens = isRecord(body) ? body.max_output_tokens : undefined
          asked.push(tokens)
          // OpenAI refuses fewer than 16 tokens; past that, this key is refused, which says the
          // request itself was accepted.
          if (typeof tokens === 'number' && tokens >= 16) {
            return Response.json(
              { error: { message: 'Incorrect API key provided.' } },
              { status: 401 }
            )
          }
          return Response.json(
            {
              error: {
                message: `Invalid 'max_output_tokens': integer below minimum value. Expected a value >= 16, but got ${String(tokens)} instead.`,
                type: 'invalid_request_error'
              }
            },
            { status: 400 }
          )
        }
      }
    )
    expect(asked.length).toBeGreaterThan(0)
    for (const tokens of asked) expect(tokens).toBeGreaterThanOrEqual(16)
    expect(result).toEqual({ ok: false, reason: 'auth' })
  })
})
