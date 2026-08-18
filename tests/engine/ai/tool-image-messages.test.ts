import { describe, expect, test } from 'bun:test'

import type { ModelMessage } from 'ai'

import { moveToolImagesToUserMessages } from '@/app/ai/chat/tool-image-messages'

describe('moveToolImagesToUserMessages', () => {
  test('moves image tool output into a following user message', () => {
    const messages: ModelMessage[] = [
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'export_image',
            output: {
              type: 'content',
              value: [{ type: 'image-data', data: 'aGVsbG8=', mediaType: 'image/png' }]
            }
          }
        ]
      }
    ]

    const result = moveToolImagesToUserMessages(messages)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      role: 'tool',
      content: [{ output: { type: 'text' } }]
    })
    expect(result[1]).toEqual({
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'The rendered canvas image is attached in the following user message.'
        },
        { type: 'image', image: 'aGVsbG8=', mediaType: 'image/png' }
      ]
    })
  })

  test('leaves text-only tool output unchanged', () => {
    const messages: ModelMessage[] = [
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'describe',
            output: { type: 'text', value: 'Frame 100 x 100' }
          }
        ]
      }
    ]

    expect(moveToolImagesToUserMessages(messages)).toEqual(messages)
  })
})
