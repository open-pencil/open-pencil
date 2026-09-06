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
            missingOutput: { tool_call: true },
            malformedOutput: { tool_call: true, modalities: { output: 'text' } },
            imageOutput: { tool_call: true, modalities: { output: ['image'] } },
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
    for (const id of ['missingOutput', 'malformedOutput', 'imageOutput']) {
      expect(models.some((model) => model.id === id)).toBeFalse()
    }
  })

  test('falls back to curated models when the catalog request fails', async () => {
    const failingFetch = (async () => new Response(null, { status: 503 })) as typeof fetch
    const models = await listCatalogModels('anthropic', failingFetch)

    expect(models[0]).toMatchObject({ id: 'claude-sonnet-5', tag: 'Best for design' })
  })

  test('retries a failed shared request and shares a successful request', async () => {
    const originalFetch = globalThis.fetch
    let requests = 0
    globalThis.fetch = (async () => {
      requests++
      if (requests === 1) return new Response(null, { status: 503 })
      return new Response(
        JSON.stringify({
          openai: { models: { retryModel: { name: 'Retry model', tool_call: true } } }
        })
      )
    }) as typeof fetch
    try {
      expect(await resolveModelsDevModel('openai', 'retryModel')).toBeNull()
      const [first, second] = await Promise.all([
        resolveModelsDevModel('openai', 'retryModel'),
        resolveModelsDevModel('openai', 'retryModel')
      ])
      expect(first?.name).toBe('Retry model')
      expect(second).toEqual(first)
      expect(requests).toBe(2)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('preserves vision support in offline curated models', async () => {
    const failingFetch = (async () => new Response(null, { status: 503 })) as typeof fetch
    const openai = await listCatalogModels('openai', failingFetch)
    for (const id of ['gpt-5.6', 'gpt-5.5', 'gpt-5.4-mini', 'gpt-5.4-nano']) {
      expect(openai.find((model) => model.id === id)?.capabilities).toContain('vision')
    }
    const zai = await listCatalogModels('zai', failingFetch)
    expect(zai.find((model) => model.id === 'glm-5v-turbo')?.capabilities).toContain('vision')
  })

  test('returns null when the provider or model is unknown', async () => {
    expect(
      await resolveModelsDevModel('openai-compatible', 'local', catalogResponse({}))
    ).toBeNull()
  })
})
