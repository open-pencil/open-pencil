import { describe, expect, test } from 'bun:test'

import type { UIMessage } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'

import { autoCompactAt, contextTokensSinceCompaction } from '@/app/ai/chat/compaction/limits'
import {
  compactionMessage,
  compactionOf,
  messagesSinceCompaction
} from '@/app/ai/chat/compaction/marker'
import { summarizeConversation, summarySource } from '@/app/ai/chat/compaction/summarize'
import { withMetadata } from '@/app/ai/chat/metadata'

import { MOCK_USAGE } from '#tests/helpers/chat/usage'

function text(id: string, role: UIMessage['role'], value: string): UIMessage {
  return { id, role, parts: [{ type: 'text', text: value }] }
}

function reply(id: string, contextTokens: number): UIMessage {
  return withMetadata(text(id, 'assistant', 'Done'), {
    usage: { contextTokens, inputTokens: contextTokens, outputTokens: 10, cacheReadTokens: null }
  })
}

describe('compaction', () => {
  test('the model reads the latest summary and what followed it', () => {
    const marker = compactionMessage({
      summary: 'Built the hero.',
      trigger: 'manual',
      tokensBefore: 9000
    })
    const messages = [
      text('a', 'user', 'Make a hero'),
      reply('b', 9000),
      marker,
      text('c', 'user', 'Now a footer')
    ]
    expect(messagesSinceCompaction(messages).map((message) => message.id)).toEqual([marker.id, 'c'])
    expect(compactionOf(marker)).toEqual({
      summary: 'Built the hero.',
      trigger: 'manual',
      tokensBefore: 9000
    })
    expect(marker.role).toBe('user')
    expect(marker.parts).toEqual([
      {
        type: 'text',
        text: 'The conversation so far, summarized when it was compacted:\n\nBuilt the hero.'
      }
    ])
    expect(messagesSinceCompaction([text('a', 'user', 'Hi')]).map((message) => message.id)).toEqual(
      ['a']
    )
  })

  test('the next request starts from the last reply since the summary, or the summary itself', () => {
    const marker = compactionMessage({
      summary: 'x'.repeat(400),
      trigger: 'auto',
      tokensBefore: 9000
    })
    expect(contextTokensSinceCompaction([reply('a', 9000)])).toBe(9000)
    expect(contextTokensSinceCompaction([reply('a', 9000), marker])).toBe(100)
    expect(contextTokensSinceCompaction([reply('a', 9000), marker, reply('b', 1200)])).toBe(1200)
    expect(contextTokensSinceCompaction([text('a', 'user', 'Hi')])).toBeNull()
  })

  test('compacts automatically before the window, leaving room for the reply and the next message', () => {
    expect(autoCompactAt({ contextWindow: 200_000, maxOutputTokens: 16_000 })).toBe(165_600)
    // A reply allowance past a quarter of the window counts as a quarter.
    expect(autoCompactAt({ contextWindow: 32_000, maxOutputTokens: 16_000 })).toBe(21_600)
  })

  test('the summary request leaves out images and cuts long tool results', () => {
    const long = 'y'.repeat(5000)
    const messages: UIMessage[] = [
      {
        id: 'a',
        role: 'user',
        parts: [
          { type: 'text', text: 'Match this' },
          { type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,AAAA' }
        ]
      },
      {
        id: 'b',
        role: 'assistant',
        parts: [
          {
            type: 'tool-export_image',
            toolCallId: 'call-1',
            state: 'output-available',
            input: {},
            output: long
          }
        ]
      }
    ]
    const [request, answer] = summarySource(messages)
    expect(request?.parts).toEqual([{ type: 'text', text: 'Match this' }])
    const output = answer?.parts[0] && 'output' in answer.parts[0] ? answer.parts[0].output : null
    expect(output).toBe(`${'y'.repeat(4000)}… (1000 more characters left out)`)
  })

  test('the conversation’s model writes the summary, following the instructions it is given', async () => {
    let prompt: unknown
    const model = new MockLanguageModelV4({
      doGenerate: async (options) => {
        prompt = options.prompt
        return {
          content: [{ type: 'text', text: '  ## State\n- Hero built  ' }],
          finishReason: { unified: 'stop', raw: undefined },
          usage: MOCK_USAGE,
          warnings: []
        }
      }
    })
    const summary = await summarizeConversation({
      model,
      messages: [text('a', 'user', 'Make a hero'), reply('b', 100)],
      instructions: 'keep the colors'
    })
    expect(summary).toBe('## State\n- Hero built')
    expect(JSON.stringify(prompt)).toContain(
      'Summarize the conversation above. Also follow these instructions for the summary: keep the colors'
    )
  })
})
