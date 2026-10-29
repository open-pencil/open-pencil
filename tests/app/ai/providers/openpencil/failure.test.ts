import { describe, expect, test } from 'bun:test'

import { createCloudAIClient } from '@open-pencil/cloud/client'

import { createLanguageModel } from '@/app/ai/models/language-model'
import { cloudCreditRefusal } from '@/app/ai/providers/openpencil/failure'
import { cloudModelConfig } from '@/app/ai/providers/openpencil/model'

/** What a model request fails with when the service answers `status` with `body`. */
async function modelFailure(status: number, body: unknown): Promise<unknown> {
  const client = createCloudAIClient({
    endpoint: 'https://ai.example.com',
    tokens: { token: async () => 'cloud-token', invalidate: () => undefined },
    fetch: async () => Response.json(body, { status })
  })
  const { config, runtime } = cloudModelConfig(client, 'test/model')
  const model = createLanguageModel(config, runtime)
  if (typeof model === 'string') throw new Error('Expected a model instance')
  try {
    await model.doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] })
  } catch (error) {
    return error
  }
  throw new Error('The request did not fail')
}

describe('cloudCreditRefusal', () => {
  test('reads when the allowance renews from the service’s refusal', async () => {
    const error = await modelFailure(402, {
      error: { code: 'insufficient_credits', resetsAt: '2026-11-01T00:00:00.000Z' }
    })
    expect(cloudCreditRefusal(error)).toEqual({ resetsAt: '2026-11-01T00:00:00.000Z' })
  })

  test('is a refusal without a renewal when the service does not say when', async () => {
    expect(
      cloudCreditRefusal(await modelFailure(402, { error: { code: 'insufficient_credits' } }))
    ).toEqual({ resetsAt: null })
  })

  test('is not one for an upstream’s own 402 or another refusal', async () => {
    // OpenRouter's answer when the service's own key is out of credits, passed through.
    expect(
      cloudCreditRefusal(
        await modelFailure(402, { error: { code: 402, message: 'Insufficient credits' } })
      )
    ).toBeNull()
    expect(
      cloudCreditRefusal(
        await modelFailure(429, {
          error: { code: 'rate_limited', resetsAt: '2026-11-01T00:00:00.000Z' }
        })
      )
    ).toBeNull()
    expect(cloudCreditRefusal(new Error('offline'))).toBeNull()
  })
})
