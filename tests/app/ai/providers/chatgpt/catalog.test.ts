import { describe, expect, test } from 'bun:test'

import { normalizeChatGPTModels } from '@/app/ai/providers/chatgpt/catalog'

describe('ChatGPT model catalog', () => {
  test('lists the account’s visible models by priority with their lowest reasoning level', () => {
    const models = normalizeChatGPTModels([
      {
        slug: 'gpt-6-luna',
        display_name: 'GPT-6-Luna',
        visibility: 'list',
        priority: 5,
        input_modalities: ['text'],
        supported_reasoning_levels: [{ effort: 'medium' }, { effort: 'high' }]
      },
      { slug: 'codex-auto-review', visibility: 'hide', priority: 0 },
      {
        slug: 'gpt-6.1-sol',
        display_name: 'GPT-6.1-Sol',
        visibility: 'list',
        priority: 1,
        input_modalities: ['text', 'image'],
        supported_reasoning_levels: [{ effort: 'low' }, { effort: 'xhigh' }]
      },
      { slug: 'gpt-next', visibility: 'list' },
      { display_name: 'No slug', visibility: 'list' },
      'not a model'
    ])
    expect(models).toEqual([
      {
        id: 'gpt-6.1-sol',
        name: 'GPT-6.1-Sol',
        capabilities: ['tools', 'vision'],
        minReasoningEffort: 'low'
      },
      {
        id: 'gpt-6-luna',
        name: 'GPT-6-Luna',
        capabilities: ['tools'],
        minReasoningEffort: 'medium'
      },
      { id: 'gpt-next', name: 'gpt-next', capabilities: ['tools'] }
    ])
  })
})
