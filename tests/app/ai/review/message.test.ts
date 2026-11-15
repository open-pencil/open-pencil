import { describe, expect, test } from 'bun:test'

import type { UIMessage } from 'ai'

import { messagesSinceCompaction } from '@/app/ai/chat/compaction/marker'
import { firstReply } from '@/app/ai/chat/history/title'
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

  test('is not the reply a conversation is named from', () => {
    expect(firstReply([reviewMessage(review), ask, reply])).toBe(firstReply([ask, reply]))
    expect(firstReply([reviewMessage(review), ask])).toBe('')
  })
})
