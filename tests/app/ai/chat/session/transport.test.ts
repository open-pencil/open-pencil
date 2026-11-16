import { describe, expect, test } from 'bun:test'

import { until } from '@vueuse/core'
import { isToolUIPart, type ChatTransport, type UIMessage, type UIMessageChunk } from 'ai'
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

  test('a reply that finishes with a call that never reported back does not leave it running', async () => {
    const store = createEditorStore()
    const session = createChatSessionManager({
      isConfigured: computed(() => true),
      isACPProvider: computed(() => false),
      isHarnessProvider: computed(() => false),
      providerID: computed(() => 'openrouter'),
      credentialsReady: Promise.resolve(),
      getActiveEditorStore: () => store
    })
    const chunks: UIMessageChunk[] = [
      { type: 'start' },
      { type: 'start-step' },
      {
        type: 'tool-input-available',
        toolCallId: 'call',
        toolName: 'get_page_tree',
        input: {},
        providerExecuted: true
      },
      { type: 'finish-step' },
      { type: 'finish', finishReason: 'stop' }
    ]
    session.setOverrideTransport(() => ({
      sendMessages: async () =>
        new ReadableStream<UIMessageChunk>({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(chunk)
            controller.close()
          }
        }),
      reconnectToStream: async () => null
    }))

    const chat = await session.ensureChat()
    await chat?.sendMessage({ text: 'Inspect' })

    // The reply settles once its last edit landed, a moment after it ends.
    const callState = () => chat?.messages.at(-1)?.parts.find(isToolUIPart)?.state
    await until(callState).toBe('output-error', { timeout: 1_000 })
    expect(callState()).toBe('output-error')
  })
})
