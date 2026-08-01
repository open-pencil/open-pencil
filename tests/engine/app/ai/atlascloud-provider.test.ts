import { describe, expect, test } from 'bun:test'

import { AI_PROVIDERS } from '@open-pencil/core/constants'

import { resolveLanguageModelID } from '@/app/ai/chat/model'
import { modelProviderAdapter } from '@/app/ai/providers/registry'

describe('Atlas Cloud provider', () => {
  test('registers the default and custom model configuration', () => {
    const provider = AI_PROVIDERS.find((candidate) => candidate.id === 'atlascloud')
    expect(provider).toMatchObject({
      defaultModel: 'deepseek-ai/deepseek-v4-pro',
      supportsCustomModel: true
    })
    if (!provider) throw new Error('Atlas Cloud provider is not registered')

    expect(
      resolveLanguageModelID({
        providerID: 'atlascloud',
        modelID: provider.defaultModel,
        customModelID: '  qwen/qwen3-coder  '
      })
    ).toBe('qwen/qwen3-coder')
  })

  test('creates a chat-completions model', () => {
    const model = modelProviderAdapter('atlascloud').create(
      {
        providerID: 'atlascloud',
        apiKey: 'test-key',
        modelID: 'deepseek-ai/deepseek-v4-pro',
        customModelID: '',
        customBaseURL: '',
        customAPIType: 'completions'
      },
      {}
    )
    expect(model.modelId).toBe('deepseek-ai/deepseek-v4-pro')
  })
})
