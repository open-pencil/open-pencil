import { describe, expect, test } from 'bun:test'

import {
  classifyAIChatError,
  classifyAIChatFinish,
  isInsufficientCreditError
} from '@/app/ai/chat/failure'

describe('AI chat failures', () => {
  test('recognizes provider credit and quota failures', () => {
    expect(isInsufficientCreditError({ statusCode: 402 })).toBe(true)
    expect(isInsufficientCreditError(new Error('Insufficient balance. Please top up.'))).toBe(true)
    expect(isInsufficientCreditError(new Error('Quota exceeded for this account'))).toBe(true)
    expect(isInsufficientCreditError(new Error('Rate limit reached'))).toBe(false)
  })

  test('classifies output-limit finishes', () => {
    expect(classifyAIChatFinish('length')).toEqual({ reason: 'output-limit' })
    expect(classifyAIChatFinish('stop')).toBeNull()
  })

  test('retains request details for diagnostics', () => {
    expect(classifyAIChatError(new Error('Payment required'))).toEqual({
      reason: 'insufficient-credit',
      detail: 'Payment required'
    })
    expect(classifyAIChatError(new Error('Provider unavailable'))).toEqual({
      reason: 'request-failed',
      detail: 'Provider unavailable'
    })
  })
})
