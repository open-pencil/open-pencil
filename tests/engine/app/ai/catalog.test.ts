import { afterEach, describe, expect, test } from 'bun:test'

import {
  listCatalogModels,
  resetModelsDevCatalogForTests,
  resolveModelsDevModel
} from '@/app/ai/models/catalog'

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
      recommendedMaxOutputTokens: 64_000,
      status: 'active'
    })
  })

  test('lists compatible models with curated recommendations first and latest models next', async () => {
    const models = await listCatalogModels(
      'openai',
      catalogResponse({
        openai: {
          models: {
            'gpt-5.6': {
              name: 'GPT-5.6 from catalog',
              tool_call: true,
              attachment: true,
              release_date: '2026-07-09',
              modalities: { output: ['text'] },
              limit: { output: 128_000 }
            },
            'gpt-6-preview': {
              name: 'GPT-6 Preview',
              tool_call: true,
              release_date: '2026-09-01',
              modalities: { output: ['text'] }
            },
            'gpt-image': {
              name: 'GPT Image',
              tool_call: false,
              release_date: '2026-09-02',
              modalities: { output: ['image'] }
            },
            legacy: {
              name: 'Legacy',
              tool_call: true,
              status: 'deprecated',
              release_date: '2025-01-01'
            }
          }
        }
      })
    )

    expect(models[0]).toMatchObject({
      id: 'gpt-5.6',
      name: 'GPT-5.6',
      tag: 'Best',
      capabilities: ['tools', 'vision'],
      releaseDate: '2026-07-09'
    })
    expect(models.findIndex((model) => model.id === 'gpt-6-preview')).toBeGreaterThan(0)
    expect(models.some((model) => model.id === 'gpt-image')).toBeFalse()
    expect(models.some((model) => model.id === 'legacy')).toBeFalse()
  })

  test('falls back to curated models when the catalog request fails', async () => {
    const failingFetch = (async () => new Response(null, { status: 503 })) as typeof fetch
    const models = await listCatalogModels('anthropic', failingFetch)

    expect(models[0]).toMatchObject({ id: 'claude-sonnet-5', tag: 'Best for design' })
  })

  test('returns null when the provider or model is unknown', async () => {
    expect(
      await resolveModelsDevModel('openai-compatible', 'local', catalogResponse({}))
    ).toBeNull()
  })
})
