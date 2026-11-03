import { expect, test } from 'bun:test'

import type { UIMessage } from 'ai'

import { resumableTransport } from '@/app/ai/chat/history/continuation'

test('continuation omits unfinished tool calls without altering the saved transcript', async () => {
  const messages: UIMessage[] = [
    {
      id: 'partial',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Working on it' },
        { type: 'tool-edit', toolCallId: 'pending', state: 'input-available', input: {} },
        {
          type: 'tool-read',
          toolCallId: 'finished',
          state: 'output-available',
          input: {},
          output: {}
        }
      ]
    }
  ]
  let sent: UIMessage[] = []
  const transport = resumableTransport({
    reconnectToStream: async () => null,
    sendMessages: async (options) => {
      sent = options.messages
      return new ReadableStream({
        start(controller) {
          controller.close()
        }
      })
    }
  })
  await transport.sendMessages({
    chatId: 'chat',
    trigger: 'submit-message',
    messageId: undefined,
    messages,
    abortSignal: undefined
  })
  expect(sent[0]?.parts).toHaveLength(2)
  expect(messages[0]?.parts).toHaveLength(3)
  expect(
    sent[0]?.parts.some((part) => 'toolCallId' in part && part.toolCallId === 'finished')
  ).toBe(true)
})
