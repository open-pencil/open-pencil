import { describe, expect, test } from 'bun:test'

import type { LanguageModel } from 'ai'

import { AI_PROVIDERS } from '@open-pencil/core/constants'
import type { AIProviderID } from '@open-pencil/core/constants'

import { resolveLanguageModelID } from '@/app/ai/models/language-model'
import { resolveProviderModel } from '@/app/ai/models/reasoning/floors'
import { reasoningCallSettings } from '@/app/ai/models/reasoning/settings'
import type { ThinkingLevel } from '@/app/ai/models/types'
import { createAnthropicCompatibleAdapter } from '@/app/ai/providers/compatible'
import { modelProviderAdapter, providerTakesWebPImages } from '@/app/ai/providers/registry'
import type { ModelConfig } from '@/app/ai/providers/types'
import type { FetchFunction } from '@/app/http/types'

function languageModelInstance(model: LanguageModel): Exclude<LanguageModel, string> {
  if (typeof model === 'string') throw new Error(`Expected a model instance, got ${model}`)
  return model
}

/** The JSON body a curated model sends at a thinking level, with its reasoning floor applied. */
async function thinkingRequestBody(
  providerID: AIProviderID,
  modelID: string,
  level: ThinkingLevel
): Promise<unknown> {
  let requestBody = ''
  const fetchSpy: FetchFunction = async (_input, init) => {
    requestBody = String(init?.body)
    throw new Error('stop')
  }
  const model = languageModelInstance(
    modelProviderAdapter(providerID).create(
      {
        providerID,
        apiKey: 'test-key',
        modelID,
        customModelID: '',
        customBaseURL: '',
        customAPIType: 'completions'
      },
      { fetch: fetchSpy }
    )
  )
  const known = await resolveProviderModel(providerID, modelID)
  await Promise.resolve(
    model.doGenerate({
      ...reasoningCallSettings(providerID, level, known?.minReasoningEffort),
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }]
    })
  ).catch(() => undefined)
  return JSON.parse(requestBody)
}

describe('resolveLanguageModelID', () => {
  test('uses the selected OpenRouter model when no custom model is configured', () => {
    expect(
      resolveLanguageModelID({
        providerID: 'openrouter',
        modelID: 'anthropic/claude-sonnet-4.6',
        customModelID: ''
      })
    ).toBe('anthropic/claude-sonnet-4.6')
  })

  test('uses a custom OpenRouter model ID when provided', () => {
    expect(
      resolveLanguageModelID({
        providerID: 'openrouter',
        modelID: 'anthropic/claude-sonnet-4.6',
        customModelID: '  meta-llama/llama-3.3-70b-instruct  '
      })
    ).toBe('meta-llama/llama-3.3-70b-instruct')
  })
})

describe('model provider registry', () => {
  test('offers Flash first and M3 as the MiniMax fallback', () => {
    const provider = AI_PROVIDERS.find(({ id }) => id === 'minimax')
    expect(provider?.defaultModel).toBe('MiniMax-M3.1-Flash')
    expect(provider?.models.map(({ id }) => id)).toEqual(['MiniMax-M3.1-Flash', 'MiniMax-M3'])
  })

  test.each(['MiniMax-M3.1-Flash', 'MiniMax-M3', 'MiniMax-M2.7'])(
    'sends %s through the OpenAI-compatible chat endpoint',
    async (modelID) => {
      let requestURL = ''
      let requestBody = ''
      const fetchSpy: FetchFunction = async (input, init) => {
        requestURL = String(input)
        requestBody = String(init?.body)
        throw new Error('stop')
      }
      const config: ModelConfig = {
        providerID: 'minimax',
        apiKey: 'test-key',
        modelID,
        customModelID: '',
        customBaseURL: '',
        customAPIType: 'completions'
      }

      const model = languageModelInstance(
        modelProviderAdapter('minimax').create(config, { fetch: fetchSpy })
      )
      await Promise.resolve(
        model.doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] })
      ).catch(() => undefined)

      const body: unknown = JSON.parse(requestBody)
      expect(requestURL).toBe('https://api.minimax.io/v1/chat/completions')
      expect(body).toMatchObject({ model: modelID })
      expect(body).not.toHaveProperty('reasoning_effort')
      expect(body).not.toHaveProperty('thinking')
    }
  )

  test.each(['off', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const)(
    'sends a supported Flash effort for %s',
    async (level) => {
      expect(await thinkingRequestBody('minimax', 'MiniMax-M3.1-Flash', level)).toMatchObject({
        model: 'MiniMax-M3.1-Flash',
        reasoning_effort: level === 'off' || level === 'minimal' ? 'low' : level
      })
    }
  )

  describe.each(['off', 'minimal'] as const)('at %s thinking', (level) => {
    test.each([
      ['zai', 'glm-5.3', { thinking: { type: 'enabled' } }],
      ['zai', 'glm-5.3-flash', { thinking: { type: 'enabled' } }],
      [
        'google',
        'gemini-4-argon',
        { generationConfig: { thinkingConfig: { thinkingLevel: 'low' } } }
      ],
      [
        'google',
        'gemini-3.1-pro-preview',
        { generationConfig: { thinkingConfig: { thinkingLevel: 'low' } } }
      ],
      ['openai', 'gpt-6.1-sol', { reasoning: { effort: 'low' } }],
      ['openai', 'gpt-6-astra', { reasoning: { effort: 'low' } }]
    ] as const)('%s %s sends the lowest thinking it accepts', async (providerID, modelID, sent) => {
      expect(await thinkingRequestBody(providerID, modelID, level)).toMatchObject(sent)
    })
  })

  test('registers every direct provider without handling agent runtimes as models', () => {
    for (const provider of AI_PROVIDERS.filter((entry) => entry.id !== 'harness:pi')) {
      expect(modelProviderAdapter(provider.id).create).toBeFunction()
    }
    expect(() => modelProviderAdapter('harness:pi')).toThrow('Harness agents')
    expect(() => modelProviderAdapter('acp:claude-code')).toThrow(
      'ACP providers and Harness agents do not use direct API models'
    )
  })

  test('sends a tool image to a Chat Completions endpoint in a user message after the tool result', async () => {
    let requestBody = ''
    const fetchSpy: FetchFunction = async (_input, init) => {
      requestBody = String(init?.body)
      throw new Error('stop')
    }
    const model = languageModelInstance(
      modelProviderAdapter('minimax').create(
        {
          providerID: 'minimax',
          apiKey: 'test-key',
          modelID: 'MiniMax-M3',
          customModelID: '',
          customBaseURL: '',
          customAPIType: 'completions'
        },
        { fetch: fetchSpy }
      )
    )
    if (model.specificationVersion !== 'v4') throw new Error('Expected a v4 model')
    await Promise.resolve(
      model.doGenerate({
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'Check the frame' }] },
          {
            role: 'assistant',
            content: [
              { type: 'tool-call', toolCallId: 'call-1', toolName: 'export_image', input: {} }
            ]
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call-1',
                toolName: 'export_image',
                output: {
                  type: 'content',
                  value: [
                    { type: 'text', text: '{"width":2}' },
                    {
                      type: 'file',
                      mediaType: 'image/png',
                      data: { type: 'data', data: 'iVBORw0KGgo=' }
                    }
                  ]
                }
              }
            ]
          }
        ]
      })
    ).catch(() => undefined)

    const body: unknown = JSON.parse(requestBody)
    expect(body).toMatchObject({
      messages: [
        { role: 'user' },
        { role: 'assistant' },
        {
          role: 'tool',
          tool_call_id: 'call-1',
          content: '{"width":2}\nThe images follow in the next user message.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Images from the export_image call call-1:' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' } }
          ]
        }
      ]
    })
  })

  test('sends WebP tool images only where the provider itself documents WebP input', () => {
    // An endpoint behind a compatible API, a router, or Cloud may not decode WebP.
    const documented = new Set<AIProviderID>(['anthropic', 'openai', 'google', 'deepseek'])
    for (const { id } of AI_PROVIDERS) {
      expect({ id, webp: providerTakesWebPImages(id) }).toEqual({ id, webp: documented.has(id) })
    }
    expect(providerTakesWebPImages('acp:claude-code')).toBe(false)
  })
})

describe('anthropic compatible adapter', () => {
  const config: ModelConfig = {
    providerID: 'anthropic',
    apiKey: 'test-key',
    modelID: 'claude-sonnet-4.6',
    customModelID: '',
    customBaseURL: '',
    customAPIType: 'completions'
  }

  async function capturedHeaders(): Promise<Record<string, string>> {
    let captured: Record<string, string> = {}
    const fetchSpy: FetchFunction = async (_input, init) => {
      captured = Object.fromEntries(new Headers(init?.headers).entries())
      throw new Error('stop')
    }

    const model = languageModelInstance(
      createAnthropicCompatibleAdapter().create(config, { fetch: fetchSpy })
    )
    await Promise.resolve(
      model.doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] })
    ).catch(() => undefined)

    return captured
  }

  test('opts into direct browser access so Anthropic returns CORS headers', async () => {
    // Anthropic omits Access-Control-Allow-Origin unless this header is sent, which makes the
    // web build fail with an opaque network error. See #436.
    expect(await capturedHeaders()).toHaveProperty(
      'anthropic-dangerous-direct-browser-access',
      'true'
    )
  })
})
