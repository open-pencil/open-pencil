import { describe, expect, test } from 'bun:test'

import type { ChatTransport, UIMessage } from 'ai'
import { computed } from 'vue'

import { createChatSessionManager } from '@/app/ai/chat/session'
import { createEditorStore } from '@/app/editor/session/create'

const idleTransport: ChatTransport<UIMessage> = {
  sendMessages: async () => new ReadableStream(),
  reconnectToStream: async () => null
}

describe('chat transport', () => {
  test('a model change while the transport loads rebuilds the chat', async () => {
    const store = createEditorStore()
    const session = createChatSessionManager({
      isConfigured: computed(() => true),
      isACPProvider: computed(() => false),
      isHarnessProvider: computed(() => false),
      providerID: computed(() => 'openrouter'),
      credentialsReady: Promise.resolve(),
      getActiveEditorStore: () => store
    })
    let builds = 0
    session.setOverrideTransport(() => {
      builds++
      if (builds === 1) session.markTransportDirty()
      return idleTransport
    })

    const stale = await session.ensureChat()
    const rebuilt = await session.ensureChat()

    expect(rebuilt).not.toBe(stale)
    expect(await session.ensureChat()).toBe(rebuilt)
    expect(builds).toBe(2)
  })
})
