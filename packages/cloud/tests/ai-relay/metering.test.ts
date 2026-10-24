import { describe, expect, test } from 'bun:test'

import { creditsFor, meteredUsage } from '#cloud/ai-relay'
import type { AIModel } from '#cloud/contract'

const model: AIModel = {
  id: 'model',
  label: 'Model',
  creditsPerMillionInputTokens: 3000,
  creditsPerMillionOutputTokens: 15000,
  contextTokens: 200_000,
  capabilities: { reasoning: false, vision: false, tools: true }
}

function stream(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    }
  })
}

describe('AI relay metering', () => {
  test('charges per million tokens and rounds up', () => {
    expect(creditsFor(model, { inputTokens: 1_000_000, outputTokens: 0 })).toBe(3000)
    expect(creditsFor(model, { inputTokens: 1000, outputTokens: 1000 })).toBe(18)
    expect(creditsFor(model, { inputTokens: 1, outputTokens: 0 })).toBe(1)
    expect(creditsFor(model, { inputTokens: 0, outputTokens: 0 })).toBe(0)
  })

  test('reads usage from a JSON answer', async () => {
    const body = JSON.stringify({
      choices: [],
      usage: { prompt_tokens: 12, completion_tokens: 34 }
    })
    expect(await meteredUsage(stream(body), false)).toEqual({ inputTokens: 12, outputTokens: 34 })
    expect(await meteredUsage(stream('{"choices":[]}'), false)).toBeNull()
  })

  test('reads usage from the last event that carries it, across chunk boundaries', async () => {
    const usage = await meteredUsage(
      stream(
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n: keep-alive\n\nda',
        'ta: {"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":7}}\r\n\r\n',
        'data: [DONE]\n\n'
      ),
      true
    )
    expect(usage).toEqual({ inputTokens: 5, outputTokens: 7 })
    expect(await meteredUsage(stream('data: {"choices":[]}\n\ndata: [DONE]'), true)).toBeNull()
  })
})
