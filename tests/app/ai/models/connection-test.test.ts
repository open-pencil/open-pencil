import { describe, expect, test } from 'bun:test'

import { createCloudAIClient } from '@open-pencil/cloud/client'

import { testProviderConnection } from '@/app/ai/models/connection-test'
import { cloudModelConfig } from '@/app/ai/providers/openpencil/model'

/** Tests a Cloud model whose service answers every request with `status` and `body`. */
function testCloudModel(status: number, body: unknown) {
  const client = createCloudAIClient({
    endpoint: 'https://ai.example.com',
    tokens: { token: async () => 'cloud-token', invalidate: () => undefined },
    fetch: async () => Response.json(body, { status })
  })
  const { config, runtime } = cloudModelConfig(client, 'test/model')
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
