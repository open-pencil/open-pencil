import { describe, expect, test } from 'bun:test'

import type { UIMessage } from 'ai'
import { shallowRef } from 'vue'

import { SceneGraph } from '@open-pencil/scene-graph'
import { asDouble } from '@open-pencil/test-support/doubles'

import type { ChatInstance } from '@/app/ai/chat/submission/types'
import type { AIModelRuntime } from '@/app/ai/models/runtime'
import { reviewOf } from '@/app/ai/review/message'
import type { ReviewDependencies } from '@/app/ai/review/run'
import { useChatReview } from '@/app/ai/review/use'
import type { EditorStore } from '@/app/editor/session/create'

function editor() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const card = graph.createNode('FRAME', page.id, { name: 'Card', width: 320, height: 200 })
  return asDouble<EditorStore>({
    graph,
    state: { currentPageId: page.id, selectedIds: new Set([card.id]) },
    flushComponentSync: () => undefined,
    renderExportImage: async () => new Uint8Array([1])
  })
}

const reviewer: ReviewDependencies = {
  createRuntime: async () =>
    asDouble<AIModelRuntime>({ kind: 'direct', role: { profile: { capabilities: ['vision'] } } }),
  ask: asDouble<ReviewDependencies['ask']>(async () => ({ findings: '- Pad it.', zoomInto: [] }))
}

describe('reviewing from the chat', () => {
  test('adds the review to a conversation it starts', async () => {
    const chat = shallowRef<ChatInstance | null>(null)
    const made = asDouble<ChatInstance>({ messages: [] as UIMessage[] })
    const review = useChatReview({
      chat,
      ensureChat: async () => made,
      store: editor,
      dependencies: reviewer
    })

    expect(await review.review({ focus: 'spacing' })).toBe(true)
    expect(chat.value).toBe(made)
    expect(made.messages.map(reviewOf)).toEqual([
      { findings: '- Pad it.', nodeIds: [expect.any(String)], focus: 'spacing' }
    ])
    expect(review.reviewing.value).toBe(false)
  })

  test('adds nothing to a conversation left while it ran', async () => {
    const chat = shallowRef<ChatInstance | null>(null)
    const first = asDouble<ChatInstance>({ messages: [] as UIMessage[] })
    const review = useChatReview({
      chat,
      ensureChat: async () => first,
      store: editor,
      dependencies: {
        ...reviewer,
        ask: asDouble<ReviewDependencies['ask']>(async () => {
          chat.value = asDouble<ChatInstance>({ messages: [] })
          return { findings: '- Pad it.', zoomInto: [] }
        })
      }
    })

    expect(await review.review({})).toBe(false)
    expect(first.messages).toEqual([])
  })

  test('keeps why it failed, for the chat to report', async () => {
    const chat = shallowRef<ChatInstance | null>(null)
    const review = useChatReview({
      chat,
      ensureChat: async () => asDouble<ChatInstance>({ messages: [] }),
      store: editor,
      dependencies: { ...reviewer, createRuntime: async () => null }
    })
    expect(await review.review({})).toBe(false)
    expect(review.failed.value).toBeInstanceOf(Error)
  })
})
