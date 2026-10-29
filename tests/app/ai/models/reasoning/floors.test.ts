import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import {
  normalizeOpenRouterModel,
  resetOpenRouterModelsForTests,
  resolveProviderModel
} from '@/app/ai/models/reasoning/floors'

import { fetchStub } from '#tests/helpers/fetch'

afterEach(() => resetOpenRouterModelsForTests())

describe('normalizeOpenRouterModel', () => {
  test('keeps tool-capable OpenRouter models', () => {
    expect(
      normalizeOpenRouterModel({
        id: 'meta-llama/llama-3.3-70b-instruct',
        name: 'Llama 3.3 70B Instruct',
        supported_parameters: ['tools'],
        architecture: { input_modalities: ['text', 'image'] },
        top_provider: { max_completion_tokens: 32_768 }
      })
    ).toEqual({
      id: 'meta-llama/llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B Instruct',
      capabilities: ['tools', 'vision'],
      recommendedMaxOutputTokens: 32_768
    })
  })

  test('skips OpenRouter models without tool support', () => {
    expect(
      normalizeOpenRouterModel({
        id: 'text-only/model',
        name: 'Text Only',
        supported_parameters: []
      })
    ).toBeNull()
  })

  test('takes the lowest listed effort of models that always reason', () => {
    const model = (reasoning: { mandatory: boolean; supported_efforts?: string[] }) =>
      normalizeOpenRouterModel({ id: 'm', supported_parameters: ['tools'], reasoning })
    expect(
      model({ mandatory: true, supported_efforts: ['max', 'xhigh', 'high', 'medium', 'low'] })
    ).toMatchObject({ minReasoningEffort: 'low' })
    expect(model({ mandatory: true })).toMatchObject({ minReasoningEffort: 'minimal' })
    expect(model({ mandatory: false, supported_efforts: ['low'] })).not.toHaveProperty(
      'minReasoningEffort'
    )
  })
})

describe('resolveProviderModel', () => {
  test('reads curated models for direct providers', async () => {
    expect(await resolveProviderModel('minimax', 'MiniMax-M3.1-Flash')).toMatchObject({
      minReasoningEffort: 'low'
    })
    expect(await resolveProviderModel('minimax', 'MiniMax-M3')).not.toHaveProperty(
      'minReasoningEffort'
    )
  })

  test('reads OpenRouter’s own model metadata', async () => {
    const fetcher = fetchStub(async () =>
      Response.json({
        data: [
          {
            id: 'minimax/minimax-m3.1-flash:free',
            supported_parameters: ['tools', 'reasoning'],
            reasoning: { mandatory: true, supported_efforts: ['max', 'low'] }
          }
        ]
      })
    )
    expect(
      await resolveProviderModel('openrouter', 'minimax/minimax-m3.1-flash:free', fetcher)
    ).toMatchObject({ minReasoningEffort: 'low' })
  })

  test('falls back to curated models when the request times out, then retries', async () => {
    const deadline = new AbortController()
    const timeout = spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
    let stall = true
    const { promise: started, resolve: start } = Promise.withResolvers<undefined>()
    const fetcher = fetchStub(async (_input, init) => {
      if (!stall) {
        return Response.json({ data: [{ id: 'some/model', supported_parameters: ['tools'] }] })
      }
      start(undefined)
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })
    })
    try {
      const pending = resolveProviderModel('openrouter', 'some/model', fetcher)
      await started
      deadline.abort(new DOMException('The operation timed out.', 'TimeoutError'))
      expect(await pending).toBeUndefined()
      expect(timeout).toHaveBeenCalledWith(10_000)

      stall = false
      expect(await resolveProviderModel('openrouter', 'some/model', fetcher)).toMatchObject({
        id: 'some/model'
      })
    } finally {
      timeout.mockRestore()
    }
  })
})
