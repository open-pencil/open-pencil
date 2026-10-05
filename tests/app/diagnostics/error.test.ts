import { describe, expect, test } from 'bun:test'

import { diagnosticErrorDetails } from '@/app/diagnostics/error'

function errorWith(message: string, stack: string, name = 'TypeError'): Error {
  const error = new Error(message)
  error.name = name
  error.stack = stack
  return error
}

describe('diagnostic error details', () => {
  test('keeps a runtime error’s message and stack', () => {
    const error = errorWith(
      'Attempting to define property on object that is not extensible.',
      'TypeError: Attempting to define property\n    at merge (http://localhost:1420/src/app/ai/chat/stream.ts:12:4)'
    )
    expect(diagnosticErrorDetails(error)).toMatchObject({
      errorName: 'TypeError',
      message: 'Attempting to define property on object that is not extensible.',
      stack: expect.stringContaining('src/app/ai/chat/stream.ts:12:4')
    })
  })

  test('scrubs the message and the stack', () => {
    const error = errorWith(
      'fetch https://api.example.com/v1/chat?key=abc123 failed',
      '    at load (file:///Users/jane/Projects/app/src/x.ts:1:1)'
    )
    expect(diagnosticErrorDetails(error)).toMatchObject({
      message: 'fetch https://api.example.com/v1/chat failed',
      stack: '    at load (file:///Users/~/Projects/app/src/x.ts:1:1)'
    })
  })

  test('drops the message of an AI SDK error, which can quote the prompt, from its stack too', () => {
    const message = 'Invalid prompt: the user asked for a "secret plan"'
    const error = errorWith(
      message,
      `AI_InvalidPromptError: ${message}\n    at standardize (prompt.ts:4:2)`,
      'AI_InvalidPromptError'
    )
    expect(diagnosticErrorDetails(error)).toMatchObject({
      errorName: 'AI_InvalidPromptError',
      message: null,
      stack: 'AI_InvalidPromptError: [redacted]\n    at standardize (prompt.ts:4:2)'
    })
  })

  test('bounds the message and the stack', () => {
    const lines = Array.from({ length: 60 }, (_, i) => `    at frame${i} (app.ts:${i}:1)`)
    const details = diagnosticErrorDetails(
      errorWith('x'.repeat(30) + ' '.repeat(1) + 'y '.repeat(400), lines.join('\n'))
    )
    expect(details.message?.length).toBeLessThanOrEqual(500)
    expect(details.stack?.split('\n')).toHaveLength(25)
  })

  test('describes thrown values that are not errors', () => {
    expect(diagnosticErrorDetails('plain failure')).toMatchObject({
      errorName: 'UnknownError',
      message: 'plain failure',
      stack: null
    })
  })
})
