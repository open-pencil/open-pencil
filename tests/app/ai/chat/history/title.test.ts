import { describe, expect, test } from 'bun:test'

import type { generateText, LanguageModel, UIMessage } from 'ai'

import { asDouble } from '@open-pencil/test-support/doubles'

import { conversationTitle, type TitleDependencies } from '@/app/ai/chat/history/title'
import type { ModelQuestion } from '@/app/ai/models/ask'
import type { AIModelRuntime } from '@/app/ai/models/runtime'

const exchange: UIMessage[] = [
  {
    id: 'ask',
    role: 'user',
    parts: [{ type: 'text', text: 'Make the pricing cards the same height' }]
  },
  {
    id: 'reply',
    role: 'assistant',
    parts: [{ type: 'text', text: 'I set all three cards to fill.' }]
  }
]

type GenerateOptions = Parameters<typeof generateText>[0]

/** A Fast tasks model of `kind` that answers `answer`, recording what it was asked. */
function fastModel(answer: string | Error, kind: AIModelRuntime['kind'] = 'direct') {
  const generated: GenerateOptions[] = []
  const asked: ModelQuestion[] = []
  const fail = () => {
    if (answer instanceof Error) throw answer
  }
  const dependencies: TitleDependencies = {
    fastTasks: async () =>
      asDouble<AIModelRuntime>({
        kind,
        model: asDouble<LanguageModel>({}),
        role: {
          connection: { providerID: 'anthropic' },
          profile: { maxOutputTokens: 8000, thinkingLevel: 'default' }
        }
      }),
    generate: asDouble<typeof generateText>(async (options: GenerateOptions) => {
      generated.push(options)
      fail()
      return { output: { title: answer } }
    }),
    ask: async (_runtime, question) => {
      asked.push(question)
      fail()
      return String(answer)
    }
  }
  return { generated, asked, dependencies }
}

describe('a conversation’s title', () => {
  test('is the title an API model on Fast tasks returns as structured output', async () => {
    const fast = fastModel('Equal-height pricing cards')
    expect(await conversationTitle(exchange, fast.dependencies)).toBe('Equal-height pricing cards')
    expect(fast.generated).toHaveLength(1)
    expect(fast.generated[0]?.output).toBeDefined()
    expect(fast.generated[0]?.prompt).toContain('Make the pricing cards the same height')
    expect(fast.generated[0]?.prompt).toContain('I set all three cards to fill.')
    expect(fast.asked).toEqual([])
  })

  test('is what a coding agent on Fast tasks answers', async () => {
    const fast = fastModel('  Pricing cards  ', 'acp')
    expect(await conversationTitle(exchange, fast.dependencies)).toBe('Pricing cards')
    expect(fast.asked).toHaveLength(1)
    expect(fast.generated).toEqual([])
  })

  test('stays the first message when no model is assigned to Fast tasks', async () => {
    const fast = fastModel('Unused')
    const dependencies = { ...fast.dependencies, fastTasks: async () => null }
    expect(await conversationTitle(exchange, dependencies)).toBeNull()
    expect(fast.generated).toEqual([])
  })

  test('stays the first message for Pi, which takes no question outside a chat', async () => {
    const fast = fastModel('Unused', 'harness')
    expect(await conversationTitle(exchange, fast.dependencies)).toBeNull()
    expect(fast.asked).toEqual([])
    expect(fast.generated).toEqual([])
  })

  test.each(['direct', 'acp'] as const)(
    'stays the first message when a %s model fails',
    async (kind) => {
      const fast = fastModel(new Error('No credit'), kind)
      expect(await conversationTitle(exchange, fast.dependencies)).toBeNull()
    }
  )

  test('is not asked for before the conversation has a reply', async () => {
    const fast = fastModel('Unused')
    expect(await conversationTitle(exchange.slice(0, 1), fast.dependencies)).toBeNull()
    expect(fast.generated).toEqual([])
  })
})
