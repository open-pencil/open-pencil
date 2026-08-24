import { describe, expect, test } from 'bun:test'

import type { DiagnosticEvent } from '@/app/diagnostics'
import { summarizeUsage } from '@/app/usage'

function event(name: string, attributes: DiagnosticEvent['attributes']): DiagnosticEvent {
  return { id: crypto.randomUUID(), timestamp: 0, category: 'ai', level: 'info', name, attributes }
}

describe('summarizeUsage', () => {
  test('aggregates reported usage and model counts', () => {
    const summary = summarizeUsage([
      event('model.step.completed', {
        provider: 'openai',
        model: 'gpt-4o',
        inputTokens: 100,
        outputTokens: 20,
        cacheReadTokens: 30,
        cacheWriteTokens: 0
      }),
      event('chat.completed', { finishReason: 'stop' })
    ])
    expect(summary.requests).toBe(1)
    expect(summary.inputTokens).toBe(100)
    expect(summary.outputTokens).toBe(20)
    expect(summary.cacheReadTokens).toBe(30)
    expect(summary.models).toEqual([{ provider: 'openai', model: 'gpt-4o', requests: 1 }])
  })

  test('preserves unavailable telemetry as null', () => {
    const summary = summarizeUsage([
      event('model.step.completed', {
        provider: 'openai',
        model: 'compatible',
        inputTokens: 10,
        outputTokens: 2,
        cacheReadTokens: null,
        cacheWriteTokens: null
      })
    ])
    expect(summary.cacheReadTokens).toBeNull()
    expect(summary.unavailableCacheTelemetry).toBe(1)
  })
})
