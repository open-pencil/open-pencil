import { describe, expect, test } from 'bun:test'

import type { LanguageModel } from 'ai'

import { createCloudAIClient } from '@open-pencil/cloud/client'

import { createLanguageModel } from '@/app/ai/chat/model'
import { cloudCatalogModels } from '@/app/ai/providers/openpencil/catalog'
import { cloudModelConfig } from '@/app/ai/providers/openpencil/model'

function languageModelInstance(model: LanguageModel): Exclude<LanguageModel, string> {
  if (typeof model === 'string') throw new Error(`Expected a model instance, got ${model}`)
  return model
}

describe('OpenPencil Cloud models', () => {
  test('send chat completions to the service with the Cloud token, not a key', async () => {
    const requests: Request[] = []
    const client = createCloudAIClient({
      endpoint: 'https://ai.example.com',
      tokens: { token: async () => 'cloud-token', invalidate: () => undefined },
      fetch: async (input, init) => {
        requests.push(new Request(input, init))
        throw new Error('stop')
      }
    })
    const { config, runtime } = cloudModelConfig(client, 'anthropic/claude-sonnet-5-5')
    const model = languageModelInstance(createLanguageModel(config, runtime))
    await Promise.resolve(
      model.doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] })
    ).catch(() => undefined)

    expect(requests[0]?.url).toBe('https://ai.example.com/v1/chat/completions')
    expect(requests[0]?.headers.get('Authorization')).toBe('Bearer cloud-token')
    expect(await requests[0]?.json()).toMatchObject({ model: 'anthropic/claude-sonnet-5-5' })
  })

  test('lists the catalog with the capabilities the picker records', () => {
    const capabilities = (tools: boolean, vision: boolean) => ({ reasoning: false, tools, vision })
    const model = (id: string, tools: boolean, vision: boolean) => ({
      id,
      label: id.toUpperCase(),
      creditsPerMillionInputTokens: 1,
      creditsPerMillionOutputTokens: 1,
      contextTokens: 1,
      capabilities: capabilities(tools, vision)
    })
    expect(
      cloudCatalogModels({
        defaultModelID: 'a',
        models: [model('a', true, true), model('b', true, false), model('c', false, false)]
      })
    ).toEqual([
      { id: 'a', name: 'A', capabilities: ['tools', 'vision'] },
      { id: 'b', name: 'B', capabilities: ['tools'] },
      { id: 'c', name: 'C', capabilities: [] }
    ])
  })
})
