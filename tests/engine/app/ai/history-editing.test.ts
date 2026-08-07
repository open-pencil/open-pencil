import { describe, expect, test } from 'bun:test'

import type { UIMessage } from 'ai'

import { removeMessageFromHistory, removePartFromHistory } from '@/app/ai/chat/history'

describe('chat history editing', () => {
  const messages: UIMessage[] = [
    {
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Inspect this frame' }]
    },
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'dynamic-tool',
          toolName: 'render',
          toolCallId: 'call-1',
          state: 'output-available',
          input: { nodeId: '1:2' },
          output: { mimeType: 'image/png' }
        },
        { type: 'text', text: 'The frame is visible.' }
      ]
    }
  ]

  test('removes a complete tool execution while preserving sibling parts', () => {
    const updated = removePartFromHistory(messages, 'assistant-1', 'call-1')

    expect(updated).toHaveLength(2)
    expect(updated[1].parts).toEqual([{ type: 'text', text: 'The frame is visible.' }])
  })

  test('removes the message when its last part is removed', () => {
    const toolOnly: UIMessage[] = [{ ...messages[1], parts: [messages[1].parts[0]] }]

    expect(removePartFromHistory(toolOnly, 'assistant-1', 'call-1')).toEqual([])
  })

  test('removes a whole message', () => {
    expect(removeMessageFromHistory(messages, 'user-1')).toEqual([messages[1]])
  })
})
