import { describe, expect, test } from 'bun:test'

import { shallowRef } from 'vue'

import { useChatCompaction } from '@/app/ai/chat/compaction/use'
import type { ChatInstance } from '@/app/ai/chat/submission/types'

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
})
