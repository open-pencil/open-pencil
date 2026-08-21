import { beforeEach, describe, expect, test } from 'bun:test'

import type { UIMessage } from 'ai'

import { safeFailureDetail, serializeChatLog } from '@/app/ai/debug'
import { setActiveEditorStore } from '@/app/editor/active-store'
import { createEditorStore } from '@/app/editor/session'
import { clearToolLogEntries, recordStepUsage } from '@/app/ai/tools'

const messages: UIMessage[] = [
  { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Create a card' }] }
]

describe('AI debug log', () => {
  setActiveEditorStore(createEditorStore())

  beforeEach(() => {
    clearToolLogEntries()
    recordStepUsage({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      timestamp: 0
    })
  })

  test('records request-level failures', () => {
    const log = serializeChatLog(messages, {
      reason: 'insufficient-credit',
      detail: '402 Payment Required'
    })

    expect(log).toContain('=== ERRORS ===')
    expect(log).toContain('insufficient-credit: 402 Payment Required')
  })

  test('redacts and bounds request failure details', () => {
    const secret = `Authorization: Bearer-secret ${'x'.repeat(300)}`
    const detail = safeFailureDetail(secret)
    expect(detail).not.toContain('Bearer-secret')
    expect(detail).toContain('[redacted]')
    expect(detail.length).toBeLessThanOrEqual(241)
  })

  test('reports when no request failure was recorded', () => {
    expect(serializeChatLog(messages)).toContain('=== ERRORS ===\n\n  (none recorded)')
  })

  test('reports zero cache tokens as an observation for providers without cache_control', () => {
    const log = serializeChatLog(messages, null, { providerID: 'openai', modelID: 'gpt-4o' })
    expect(log).toContain('No cache tokens reported by this provider (it may not report them)')
    expect(log).not.toContain('NO CACHE TOKENS REPORTED')
  })

  test('warns when an Anthropic-family provider sends cache_control but reports zero tokens', () => {
    const log = serializeChatLog(messages, null, { providerID: 'anthropic', modelID: 'claude-3-5' })
    expect(log).toContain('⚠ NO CACHE TOKENS REPORTED — cache_control was sent')
    expect(log).not.toContain('No cache tokens reported by this provider')
  })
})
