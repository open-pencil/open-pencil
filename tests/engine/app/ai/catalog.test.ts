import { afterEach, describe, expect, test } from 'bun:test'

import { resetModelsDevCatalogForTests, resolveModelsDevModel } from '@/app/ai/models/catalog'

function catalogResponse(body: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch
}

afterEach(() => resetModelsDevCatalogForTests())

describe('models.dev catalog', () => {
  test('resolves provider model capabilities and output limits', async () => {
    const model = await resolveModelsDevModel(
      'anthropic',
      'claude-sonnet-4-6-20260301',
      catalogResponse({
        anthropic: {
          models: {
            'claude-sonnet-4-6': {
              name: 'Claude Sonnet 4.6',
              tool_call: true,
              attachment: true,
              limit: { output: 64_000 }
            }
          }
        }
      })
    )

    expect(model).toEqual({
      id: 'claude-sonnet-4-6-20260301',
      name: 'Claude Sonnet 4.6',
      capabilities: ['tools', 'vision'],
      recommendedMaxOutputTokens: 64_000
    })
  })

  test('returns null when the provider or model is unknown', async () => {
    expect(
      await resolveModelsDevModel('openai-compatible', 'local', catalogResponse({}))
    ).toBeNull()
  })
})
