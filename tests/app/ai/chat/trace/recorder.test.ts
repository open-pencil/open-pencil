import { expect, test } from 'bun:test'

import { APICallError } from 'ai'

import { expectDefined } from '@open-pencil/test-support/assert'

import { createRunRecorder } from '@/app/ai/chat/trace/recorder'

import { memoryTraceStore } from '#tests/helpers/chat/trace-store'

const KEY = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789'

test('a failed run keeps the provider error with keys scrubbed', async () => {
  const traces = memoryTraceStore()
  const recorder = createRunRecorder(traces.store)
  const run = recorder.start({
    conversationId: 'conversation',
    runId: 'run',
    model: { provider: 'anthropic', id: 'claude-test' },
    settings: { maxOutputTokens: 100, maxSteps: 5, thinking: 'default', cache: true },
    instructions: 'Design well.',
    messages: [{ id: 'request', role: 'user', parts: [{ type: 'text', text: 'Draw' }] }]
  })

  run.fail(
    new APICallError({
      message: `Invalid x-api-key: ${KEY}`,
      url: 'https://api.anthropic.com/v1/messages',
      requestBodyValues: {},
      statusCode: 401,
      responseBody: JSON.stringify({ error: { message: `Invalid x-api-key: ${KEY}` } })
    })
  )
  await recorder.flush()

  const recorded = expectDefined(traces.runs.get('run'))
  expect(recorded.outcome).toBe('failed')
  const error = expectDefined(recorded.error)
  expect(error.statusCode).toBe(401)
  expect(error.message).toContain('Invalid x-api-key')
  expect(JSON.stringify(error)).not.toContain(KEY)
})
