import { describe, expect, test } from 'bun:test'

import type { LanguageModel } from 'ai'

import { createCloudServicesClient } from '@open-pencil/cloud/client'

import { createLanguageModel } from '@/app/ai/models/language-model'
import { cloudCatalogModels } from '@/app/ai/providers/openpencil/catalog'
import { cloudModelConfig, settlingFetch } from '@/app/ai/providers/openpencil/model'

function languageModelInstance(model: LanguageModel): Exclude<LanguageModel, string> {
  if (typeof model === 'string') throw new Error(`Expected a model instance, got ${model}`)
  return model
}

describe('OpenPencil Cloud models', () => {
  test('send chat completions to the service with the Cloud token, not a key', async () => {
    const requests: Request[] = []
    const client = createCloudServicesClient({
      endpoint: 'https://ai.example.com',
      tokens: { token: async () => 'cloud-token', invalidate: () => undefined },
      fetch: async (input, init) => {
        requests.push(new Request(input, init))
        throw new Error('stop')
      }
    })
    const { config, runtime } = cloudModelConfig(
      client,
      'anthropic/claude-sonnet-5-5',
      'workspace-1'
    )
    const model = languageModelInstance(await createLanguageModel(config, runtime))
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

describe('settlingFetch', () => {
  test('reports a request settled once its answer has been read to the end', async () => {
    let settled = 0
    const fetch = settlingFetch(
      async () => new Response('data: done\n\n'),
      () => settled++
    )
    const response = await fetch('https://ai.example.com/v1/chat/completions')
    expect(settled).toBe(0)
    expect(await response.text()).toBe('data: done\n\n')
    expect(settled).toBe(1)
  })

  test('reports a request settled when it fails or its answer is cancelled', async () => {
    let settled = 0
    const failing = settlingFetch(
      () => Promise.reject(new Error('offline')),
      () => settled++
    )
    await expect(failing('https://ai.example.com/v1/chat/completions')).rejects.toThrow('offline')
    expect(settled).toBe(1)

    const cancelled = await settlingFetch(
      async () => new Response('partial'),
      () => settled++
    )('https://ai.example.com/v1/chat/completions')
    await cancelled.body?.cancel()
    expect(settled).toBe(2)
  })
})
