import { describe, expect, spyOn, test } from 'bun:test'

import type { UIMessage } from 'ai'
import { shallowRef } from 'vue'

import { compactionOf, messagesSinceCompaction } from '@/app/ai/chat/compaction/marker'
import { useChatCompaction } from '@/app/ai/chat/compaction/use'
import type { ChatInstance } from '@/app/ai/chat/submission/types'
import * as runtime from '@/app/ai/models/runtime'
import type { ResolvedAIModelRole } from '@/app/ai/models/types'

describe('useChatCompaction', () => {
  test('shows as compacting from the moment it is asked, while the chat is still reached', async () => {
    const connected = Promise.withResolvers<ChatInstance | null>()
    const compaction = useChatCompaction({
      chat: shallowRef<ChatInstance | null>(null),
      ensureChat: () => connected.promise
    })
    const compacted = compaction.compact({ trigger: 'manual' })
    expect(compaction.compacting.value).toBe(true)
    connected.resolve(null)
    expect(await compacted).toBe(false)
    expect(compaction.compacting.value).toBe(false)
  })

  test('an agent that compacts its own context gets a divider once it confirms', async () => {
    const created = spyOn(runtime, 'createAIModelRuntime').mockResolvedValue({
      kind: 'harness',
      role: {} as ResolvedAIModelRole
    })
    try {
      const messages: UIMessage[] = [
        { id: 'hi', role: 'user', parts: [{ type: 'text', text: 'Hi' }] },
        { id: 'hello', role: 'assistant', parts: [{ type: 'text', text: 'Hello' }] }
      ]
      const chat = { messages, status: 'ready' } as ChatInstance
      const asked: (string | undefined)[] = []
      const compaction = useChatCompaction({
        chat: shallowRef<ChatInstance | null>(chat),
        ensureChat: async () => chat,
        compactAgent: async (instructions) => {
          asked.push(instructions)
          return true
        }
      })
      expect(await compaction.compact({ trigger: 'manual', instructions: 'keep colors' })).toBe(
        true
      )
      expect(asked).toEqual(['keep colors'])
      expect(compactionOf(chat.messages[2])).toMatchObject({ trigger: 'manual', agent: true })
      // The chat's own model still reads the whole conversation.
      expect(messagesSinceCompaction(chat.messages).map((message) => message.id)).toEqual([
        'hi',
        'hello'
      ])
    } finally {
      created.mockRestore()
    }
  })
})
