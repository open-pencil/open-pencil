import { describe, expect, test } from 'bun:test'

import { APICallError, StreamProviderError } from 'ai'

import {
  classifyAIChatError,
  classifyAIChatFinish,
  isContextLimitError,
  isInsufficientCreditError
} from '@/app/ai/chat/failure'

describe('AI chat failures', () => {
  test('a request past the context window is its own failure, which compaction can fix', () => {
    const openAI = new APICallError({
      message: 'Bad Request',
      url: 'https://api.openai.com/v1/responses',
      requestBodyValues: {},
      statusCode: 400,
      responseBody:
        '{"error":{"code":"context_length_exceeded","message":"Your input exceeds the context window"}}'
    })
    expect(isContextLimitError(openAI)).toBe(true)
    expect(classifyAIChatError(openAI).reason).toBe('context-limit')
    expect(
      isContextLimitError(new Error('prompt is too long: 210000 tokens > 200000 maximum'))
    ).toBe(true)
    expect(isContextLimitError({ statusCode: 413 })).toBe(true)
    expect(isContextLimitError(new Error('Rate limit exceeded'))).toBe(false)
  })

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

  test('classifies actionable provider failures', () => {
    const apiError = (statusCode: number, message: string) =>
      new APICallError({
        message,
        url: 'https://provider.example/v1/chat',
        requestBodyValues: {},
        statusCode
      })

    expect(classifyAIChatError(apiError(401, 'API key expired.'))).toMatchObject({
      reason: 'authentication',
      statusCode: 401,
      retryable: false
    })
    expect(classifyAIChatError(apiError(403, 'Forbidden'))).toMatchObject({
      reason: 'forbidden',
      statusCode: 403
    })
    expect(classifyAIChatError(apiError(404, 'Model not found'))).toMatchObject({
      reason: 'model-not-found',
      statusCode: 404
    })
    expect(classifyAIChatError(apiError(429, 'Too many requests'))).toMatchObject({
      reason: 'rate-limit',
      statusCode: 429,
      retryable: true
    })
  })

  test('reports a refused sign-in or plan instead of a key for providers signed in to', () => {
    expect(classifyAIChatError({ statusCode: 401 }, { signInOnly: true }).reason).toBe(
      'sign-in-expired'
    )
    expect(classifyAIChatError({ statusCode: 403 }, { signInOnly: true }).reason).toBe(
      'plan-forbidden'
    )
    expect(classifyAIChatError({ statusCode: 429 }, { signInOnly: true }).reason).toBe('rate-limit')
  })

  test('classifies provider errors reported after the stream started', () => {
    const streamError = new StreamProviderError({
      message: 'Too many requests',
      statusCode: 429,
      isRetryable: true
    })
    expect(classifyAIChatError(streamError)).toMatchObject({
      reason: 'rate-limit',
      statusCode: 429,
      retryable: true
    })
  })

  test('classifies provider messages without exposing them as presentation copy', () => {
    expect(classifyAIChatError(new Error('API key expired.')).reason).toBe('authentication')
    expect(classifyAIChatError(new Error('Invalid API key.')).reason).toBe('authentication')
    expect(classifyAIChatError(new Error('Failed to fetch provider')).reason).toBe('network')
    expect(classifyAIChatError(new Error('Provider unavailable')).reason).toBe('request-failed')
  })

  test('retains request details for diagnostics', () => {
    expect(classifyAIChatError(new Error('Payment required'))).toMatchObject({
      reason: 'insufficient-credit',
      detail: 'Payment required'
    })
    expect(classifyAIChatError(new Error('Provider unavailable'))).toMatchObject({
      reason: 'request-failed',
      detail: 'Provider unavailable'
    })
  })
})
