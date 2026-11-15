import { describe, expect, test } from 'bun:test'

import type { UIMessage } from 'ai'

import { asDouble } from '@open-pencil/test-support/doubles'

import { messagesSinceCompaction } from '@/app/ai/chat/compaction/marker'
import { conversationTitle, type TitleDependencies } from '@/app/ai/chat/history/title'
import type { ModelQuestion } from '@/app/ai/models/ask'
import type { AIModelRuntime } from '@/app/ai/models/runtime'
import { reviewMessage, reviewOf, type DesignReview } from '@/app/ai/review/message'

const review: DesignReview = { findings: '- Pad the card.', nodeIds: ['1:2'], focus: 'spacing' }
const ask: UIMessage = { id: 'ask', role: 'user', parts: [{ type: 'text', text: 'Make a card' }] }
const reply: UIMessage = {
  id: 'reply',
  role: 'assistant',
  parts: [{ type: 'text', text: 'I made a card.' }]
}

describe('a design review in the conversation', () => {
  test('is read back as the review it holds', () => {
    expect(reviewOf(reviewMessage(review))).toEqual(review)
    expect(reviewOf(reply)).toBeNull()
  })

  test('is left out of what a model reads', () => {
    const reviewed = reviewMessage(review)
    expect(messagesSinceCompaction([ask, reply, reviewed])).toEqual([ask, reply])
  })

  test('is not the reply a conversation is named from', async () => {
    const asked: ModelQuestion[] = []
    const dependencies: TitleDependencies = {
      fastTasks: async () => asDouble<AIModelRuntime>({ kind: 'direct' }),
      ask: asDouble<TitleDependencies['ask']>(
        async (_runtime: unknown, question: ModelQuestion) => {
          asked.push(question)
          return { title: 'Card' }
        }
      )
    }
    await conversationTitle([reviewMessage(review), ask, reply], dependencies)
    expect(asked[0]?.text).toContain('I made a card.')
    expect(asked[0]?.text).not.toContain('Pad the card')
  })
})
