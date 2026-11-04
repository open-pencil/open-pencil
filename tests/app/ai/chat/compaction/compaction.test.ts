import { describe, expect, test } from 'bun:test'

import type { ModelMessage, UIMessage } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'

import { autoCompactAt, contextTokensSinceCompaction } from '@/app/ai/chat/compaction/limits'
import {
  agentCompactionMessage,
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
    // An agent's own compaction is drawn, but holds nothing the chat's model reads.
    const agent = agentCompactionMessage('manual')
    expect(compactionOf(agent)).toMatchObject({ agent: true, summary: '' })
    expect(
      messagesSinceCompaction([...messages, agent, text('d', 'user', 'And a nav')]).map(
        (message) => message.id
      )
    ).toEqual([marker.id, 'c', 'd'])
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
    // Right after a compaction, every request carries its instructions and tools with the
    // summary: what the reply that opened the conversation sent, less its request.
    const opened = withMetadata(text('f', 'assistant', 'Done'), {
      usage: {
        contextTokens: 21_000,
        firstRequestTokens: 20_010,
        inputTokens: 30_000,
        outputTokens: 10,
        cacheReadTokens: null
      }
    })
    const later = withMetadata(text('g', 'assistant', 'Done'), {
      usage: {
        contextTokens: 40_000,
        firstRequestTokens: 39_000,
        inputTokens: 39_000,
        outputTokens: 10,
        cacheReadTokens: null
      }
    })
    const ask = text('q', 'user', 'x'.repeat(40))
    expect(
      contextTokensSinceCompaction([ask, opened, text('r', 'user', 'More'), later, marker])
    ).toBe(20_100)
  })

  test('compacts automatically before the window, keeping the whole reply allowance and some room', () => {
    expect(autoCompactAt({ contextWindow: 200_000, maxOutputTokens: 16_000 })).toBe(165_600)
    // Providers reserve the reply allowance, so a prompt at the threshold still fits with it.
    expect(autoCompactAt({ contextWindow: 32_000, maxOutputTokens: 16_000 })).toBe(14_400)
    // An allowance past half the window counts as half, so some conversation still fits.
    expect(autoCompactAt({ contextWindow: 32_000, maxOutputTokens: 30_000 })).toBe(14_400)
  })

  test('the summary request leaves out images and cuts long text, tool inputs, and results', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Match this' },
          { type: 'image', image: 'AAAA', mediaType: 'image/png' }
        ]
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'render',
            input: { jsx: 'x'.repeat(5000) }
          }
        ]
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'render',
            output: {
              type: 'content',
              value: [
                { type: 'text', text: 'y'.repeat(5000) },
                { type: 'file-data', data: 'AAAA', mediaType: 'image/png' }
              ]
            }
          }
        ]
      },
      { role: 'user', content: 'z'.repeat(20_000) }
    ]
    const [request, call, result, pasted] = summarySource(messages)
    expect(request?.content).toEqual([{ type: 'text', text: 'Match this' }])
    const input = Array.isArray(call?.content) ? call.content[0] : null
    expect(input && 'input' in input && String(input.input)).toEndWith('more characters left out)')
    const output = Array.isArray(result?.content) ? result.content[0] : null
    expect(output && 'output' in output && output.output.type).toBe('text')
    expect(JSON.stringify(output)).not.toContain('AAAA')
    expect(pasted?.content).toBe(`${'z'.repeat(16_000)}… (4000 more characters left out)`)
  })

  test('past its budget the summary reads the latest summary and the newest messages', () => {
    const say = (role: 'user' | 'assistant', label: string): ModelMessage => ({
      role,
      content: `${label}${'w'.repeat(1000)}`
    })
    const labels = (messages: ModelMessage[]) =>
      messages.map((message) => String(message.content).at(0))
    const turns = [say('user', 'a'), say('assistant', 'b'), say('user', 'c'), say('assistant', 'd')]
    const summary = say('user', 's')
    expect(
      labels(summarySource([summary, ...turns], { summaryFirst: true, budget: 3200 }))
    ).toEqual(['s', 'c', 'd'])
    // Without a summary first, what is kept starts with a request.
    expect(labels(summarySource(turns, { budget: 3300 }))).toEqual(['c', 'd'])
    // The newest message stays past the budget, cut shorter to fit.
    const [newest] = summarySource([say('user', 'n'.repeat(20_000))], { budget: 2000 })
    expect(JSON.stringify(newest).length).toBeLessThanOrEqual(2000)
    expect(String(newest?.content)).toEndWith('more characters left out)')
  })

  test('a summary request too long for its model is tried again with a quarter of the budget', async () => {
    const sizes: number[] = []
    const model = new MockLanguageModelV4({
      doGenerate: async (options) => {
        sizes.push(JSON.stringify(options.prompt).length)
        if (sizes.length === 1) throw new Error('context_length_exceeded')
        return {
          content: [{ type: 'text', text: 'Summary' }],
          finishReason: { unified: 'stop', raw: undefined },
          usage: MOCK_USAGE,
          warnings: []
        }
      }
    })
    const turns = Array.from({ length: 8 }, (_, index) =>
      text(`${index}`, index % 2 ? 'assistant' : 'user', 'w'.repeat(1000))
    )
    expect(await summarizeConversation(turns, { model, budget: 8000 })).toBe('Summary')
    expect(sizes).toHaveLength(2)
    expect(sizes[1]).toBeLessThan(sizes[0] / 2)
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
    const summary = await summarizeConversation(
      [
        text('a', 'user', 'Make a hero'),
        {
          id: 'p',
          role: 'user',
          parts: [{ type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,QUFBQQ==' }]
        },
        reply('b', 100)
      ],
      { model, instructions: 'keep the colors' }
    )
    expect(summary).toBe('## State\n- Hero built')
    expect(JSON.stringify(prompt)).not.toContain('QUFBQQ')
    expect(JSON.stringify(prompt)).toContain(
      'Summarize the conversation above. Also follow these instructions for the summary: keep the colors'
    )
  })
})
