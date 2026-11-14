import { describe, expect, test } from 'bun:test'

import type { UIMessage } from 'ai'

import { asDouble } from '@open-pencil/test-support/doubles'

import { conversationTitle } from '@/app/ai/chat/history/title'
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

/** A Fast tasks model that answers `answer`, recording what it was asked. */
function fastModel(answer: string | Error, kind: AIModelRuntime['kind'] = 'direct') {
  const asked: ModelQuestion[] = []
  return {
    asked,
    dependencies: {
      fastTasks: async () => asDouble<AIModelRuntime>({ kind }),
      ask: async (_runtime: AIModelRuntime, question: ModelQuestion) => {
        asked.push(question)
        if (answer instanceof Error) throw answer
        return answer
      }
    }
  }
}

describe('a conversation’s title', () => {
  test('is what the Fast tasks model answers, from the first request and reply', async () => {
    const fast = fastModel('Equal-height pricing cards')
    expect(await conversationTitle(exchange, fast.dependencies)).toBe('Equal-height pricing cards')
    expect(fast.asked).toHaveLength(1)
    expect(fast.asked[0]?.text).toContain('Make the pricing cards the same height')
    expect(fast.asked[0]?.text).toContain('I set all three cards to fill.')
  })

  test('drops the quotes, full stop, and extra lines a model adds', async () => {
    const fast = fastModel('"Equal-height pricing cards."\nHere is why I chose it.')
    expect(await conversationTitle(exchange, fast.dependencies)).toBe('Equal-height pricing cards')
  })

  test('is written by a coding agent on Fast tasks as well', async () => {
    const fast = fastModel('Pricing cards', 'acp')
    expect(await conversationTitle(exchange, fast.dependencies)).toBe('Pricing cards')
  })

  test('stays the first message when no model is assigned to Fast tasks', async () => {
    const fast = fastModel('Unused')
    const dependencies = { ...fast.dependencies, fastTasks: async () => null }
    expect(await conversationTitle(exchange, dependencies)).toBeNull()
    expect(fast.asked).toEqual([])
  })

  test('stays the first message for Pi, which takes no question outside a chat', async () => {
    const fast = fastModel('Unused', 'harness')
    expect(await conversationTitle(exchange, fast.dependencies)).toBeNull()
    expect(fast.asked).toEqual([])
  })

  test('stays the first message when the model fails or answers nothing', async () => {
    expect(
      await conversationTitle(exchange, fastModel(new Error('No credit')).dependencies)
    ).toBeNull()
    expect(await conversationTitle(exchange, fastModel('  ').dependencies)).toBeNull()
  })

  test('is not asked for before the conversation has a reply', async () => {
    const fast = fastModel('Unused')
    expect(await conversationTitle(exchange.slice(0, 1), fast.dependencies)).toBeNull()
    expect(fast.asked).toEqual([])
  })
})
