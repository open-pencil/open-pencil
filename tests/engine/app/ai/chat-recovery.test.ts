import { describe, expect, test } from 'bun:test'

import type { UIMessage } from 'ai'

import { recoverConversationPrefix } from '@/app/ai/chat/recovery'

describe('AI chat recovery', () => {
  test('preserves completed tool results and removes the interrupted suffix', () => {
    const messages: UIMessage[] = [
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Inspect the project' }] },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'list_pages',
            toolCallId: 'call-1',
            state: 'output-available',
            input: {},
            output: { pages: ['Home'] }
          },
          { type: 'text', text: 'I will inspect Home next.', state: 'done' },
          {
            type: 'dynamic-tool',
            toolName: 'find_nodes',
            toolCallId: 'call-2',
            state: 'input-available',
            input: { page: 'Home' }
          }
        ]
      }
    ]

    const recovered = recoverConversationPrefix(messages)

    expect(recovered).toHaveLength(2)
    expect(recovered[1].parts).toHaveLength(2)
    expect(recovered[1].parts[0]).toMatchObject({ toolCallId: 'call-1' })
  })

  test('removes an assistant message with no completed parts', () => {
    const messages: UIMessage[] = [
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Inspect the project' }] },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Starting', state: 'streaming' }]
      }
    ]

    expect(recoverConversationPrefix(messages)).toEqual([messages[0]])
  })
})
