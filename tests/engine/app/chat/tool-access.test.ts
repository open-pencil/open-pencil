import 'fake-indexeddb/auto'
import { expect, test } from 'bun:test'

import { simulateReadableStream, type UIMessage } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'

import { createToolLoopTransport } from '@/app/ai/chat/transports'
import { aiToolOverrides } from '@/app/ai/tools/preferences'
import { createEditorStore } from '@/app/editor/session/create'

test('a reused AI transport refreshes actual request tools for each message', async () => {
  const previous = aiToolOverrides.value
  const store = createEditorStore()
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        initialDelayInMs: null,
        chunkDelayInMs: null,
        chunks: [
          { type: 'text-start', id: 'reply' },
          { type: 'text-delta', id: 'reply', delta: 'Done' },
          { type: 'text-end', id: 'reply' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: undefined },
            usage: {
              inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 1, text: 1, reasoning: undefined }
            }
          }
        ]
      })
    })
  })
  try {
    aiToolOverrides.value = {}
    const transport = createToolLoopTransport({
      store,
      providerID: 'openai',
      model,
      effectiveModelID: 'test',
      maxOutputTokens: 100,
      reasoningEffort: ''
    })
    async function send(history: UIMessage[] = []) {
      const stream = await transport.sendMessages({
        trigger: 'submit-message',
        chatId: 'tool-access',
        messageId: undefined,
        messages: [
          ...history,
          { id: 'user', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }
        ]
      })
      const reader = stream.getReader()
      try {
        while (true) {
          const next = await reader.read()
          if (next.done) break
          expect(next.value.type).not.toBe('error')
        }
      } finally {
        reader.releaseLock()
      }
      return model.doStreamCalls.at(-1)?.tools?.map((tool) => tool.name) ?? []
    }
    expect(await send()).not.toContain('create_component')
    aiToolOverrides.value = { create_component: true, get_components: false }
    const updated = await send()
    expect(updated).toContain('create_component')
    expect(updated).not.toContain('get_components')
    expect(model.doStreamCalls).toHaveLength(2)
    // History remains valid even if an extended tool is now disabled.
    const next = await send([
      {
        id: 'previous-result',
        role: 'assistant',
        parts: [
          {
            type: 'tool-get_current_page',
            toolCallId: 'previous-call',
            state: 'output-available',
            input: {},
            output: { id: 'page', name: 'Page 1' }
          }
        ]
      }
    ])
    expect(next).not.toContain('get_current_page')
    expect(model.doStreamCalls).toHaveLength(3)
  } finally {
    aiToolOverrides.value = previous
    store.dispose()
  }
})
