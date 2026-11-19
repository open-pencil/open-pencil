import { describe, expect, test } from 'bun:test'

import type { generateText, LanguageModel } from 'ai'

import type { ReasoningEffort } from '@open-pencil/core/constants'
import { asDouble } from '@open-pencil/test-support/doubles'

import { TITLE_ANSWER } from '@/app/ai/chat/history/title'
import { askModel, type ModelAskDependencies } from '@/app/ai/models/ask'
import type { AIModelRuntime } from '@/app/ai/models/runtime'

type GenerateOptions = Parameters<typeof generateText>[0]

/** An API model that answers with `result`, on a profile that thinks hard by default. */
function apiModel(
  result: { text?: string; output?: unknown },
  minReasoningEffort?: ReasoningEffort
) {
  const calls: GenerateOptions[] = []
  const runtime = asDouble<AIModelRuntime>({
    kind: 'direct',
    model: asDouble<LanguageModel>({}),
    minReasoningEffort,
    role: {
      connection: { providerID: 'anthropic' },
      profile: { maxOutputTokens: 8000, thinkingLevel: 'high' }
    }
  })
  const dependencies: ModelAskDependencies = {
    generate: asDouble<typeof generateText>(async (options: GenerateOptions) => {
      calls.push(options)
      return result
    })
  }
  return { runtime, calls, dependencies }
}

describe('asking a role’s model', () => {
  test('gives an API model’s text, thinking as its profile does', async () => {
    const api = apiModel({ text: 'A red square.' })
    expect(await askModel(api.runtime, { text: 'Describe it' }, api.dependencies)).toBe(
      'A red square.'
    )
    expect(api.calls[0]?.reasoning).toBe('high')
    expect(api.calls[0]?.output).toBeUndefined()
  })

  test('gives an API model’s answer in the shape asked for, as structured output', async () => {
    const api = apiModel({ output: { title: 'Pricing cards' } })
    const answer = await askModel(
      api.runtime,
      { text: 'Name it', answer: TITLE_ANSWER },
      api.dependencies
    )
    expect(answer).toEqual({ title: 'Pricing cards' })
    expect(api.calls[0]?.output).toBeDefined()
  })

  test('asks an API model not to think when told, within the answer’s limit', async () => {
    const api = apiModel({ text: 'Pricing cards' })
    await askModel(
      api.runtime,
      { text: 'Name it', thinking: 'off', maxOutputTokens: 40 },
      api.dependencies
    )
    expect(api.calls[0]?.reasoning).toBe('none')
    expect(api.calls[0]?.maxOutputTokens).toBe(40)
  })

  test('leaves a model that always thinks its least thinking and the profile’s limit', async () => {
    const api = apiModel({ text: 'Pricing cards' }, 'low')
    await askModel(
      api.runtime,
      { text: 'Name it', thinking: 'off', maxOutputTokens: 40 },
      api.dependencies
    )
    expect(api.calls[0]?.reasoning).toBe('low')
    expect(api.calls[0]?.maxOutputTokens).toBe(8000)
  })

  test('turns an agent’s text into the shape asked for', async () => {
    const runtime = asDouble<AIModelRuntime>({ kind: 'acp', agent: {}, model: '' })
    const answer = await askModel(
      runtime,
      { text: 'Name it', answer: TITLE_ANSWER },
      { askAgent: async () => 'Pricing cards' }
    )
    expect(answer).toEqual({ title: 'Pricing cards' })
  })
})
