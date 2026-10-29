import 'fake-indexeddb/auto'
import { expect, spyOn, test } from 'bun:test'

import { simulateReadableStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import * as v from 'valibot'

import type { AIProviderID } from '@open-pencil/core/constants'

import { createRunRecorder } from '@/app/ai/chat/trace/recorder'
import type { ThinkingLevel } from '@/app/ai/models/types'
import { modelProviderAdapter } from '@/app/ai/providers/registry'
import { createToolLoopTransport } from '@/app/ai/transports/tool-loop'
import { createEditorStore } from '@/app/editor/session/create'

import { expectDefined } from '#tests/helpers/assert'
import { memoryTraceStore } from '#tests/helpers/chat/trace-store'
import { MOCK_USAGE } from '#tests/helpers/chat/usage'
import { fetchStub } from '#tests/helpers/fetch'

function replyModel() {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        initialDelayInMs: null,
        chunkDelayInMs: null,
        chunks: [
          { type: 'text-start', id: 'reply' },
          { type: 'text-delta', id: 'reply', delta: 'Done' },
          { type: 'text-end', id: 'reply' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: undefined },
            usage: MOCK_USAGE
          }
        ]
      })
    })
  })
}

async function send(transport: ReturnType<typeof createToolLoopTransport>): Promise<void> {
  const stream = await transport.sendMessages({
    trigger: 'submit-message',
    chatId: 'thinking-level',
    messageId: undefined,
    abortSignal: undefined,
    messages: [{ id: 'user', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }]
  })
  const reader = stream.getReader()
  try {
    while (!(await reader.read()).done);
  } finally {
    reader.releaseLock()
  }
}

test('each message uses the thinking level chosen when it is sent', async () => {
  const store = createEditorStore()
  const model = replyModel()
  let level: ThinkingLevel = 'high'
  try {
    const transport = createToolLoopTransport({
      store,
      providerID: 'anthropic',
      model,
      effectiveModelID: 'claude-test',
      maxOutputTokens: 100,
      thinkingLevel: () => level
    })
    await send(transport)
    level = 'off'
    await send(transport)
    level = 'default'
    await send(transport)
    expect(model.doStreamCalls.map((call) => call.reasoning)).toEqual(['high', 'none', undefined])
    // Prompt caching survives alongside the reasoning level.
    expect(model.doStreamCalls[0]?.providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } }
    })
  } finally {
    store.dispose()
  }
})

test('OpenRouter receives the level as its own reasoning option', async () => {
  const store = createEditorStore()
  const model = replyModel()
  try {
    const transport = createToolLoopTransport({
      store,
      providerID: 'openrouter',
      model,
      effectiveModelID: 'openai/gpt-test',
      maxOutputTokens: 100,
      thinkingLevel: () => 'minimal'
    })
    await send(transport)
    expect(model.doStreamCalls[0]?.providerOptions).toEqual({
      openrouter: { reasoning: { effort: 'minimal' } }
    })
  } finally {
    store.dispose()
  }
})

const RequestBody = v.pipe(v.string(), v.parseJson(), v.record(v.string(), v.unknown()))

/** Sends one message through the provider's real SDK model and returns the request it serialized,
 * checking that the run's trace reports caching as sent. */
async function serializedRequest(
  providerID: AIProviderID,
  modelID: string,
  level: ThinkingLevel
): Promise<Record<string, unknown>> {
  const bodies: unknown[] = []
  const model = modelProviderAdapter(providerID).create(
    {
      providerID,
      apiKey: 'synthetic-unused-key',
      modelID,
      customModelID: '',
      customBaseURL: 'https://compatible.invalid/v1',
      customAPIType: 'completions'
    },
    {
      fetch: fetchStub(async (_input, init) => {
        bodies.push(init?.body)
        throw new Error('Request intercepted')
      })
    }
  )
  const store = createEditorStore()
  const traces = memoryTraceStore()
  const recorder = createRunRecorder(traces.store)
  // The SDK logs the intercepted request's failure.
  const consoleError = spyOn(console, 'error').mockImplementation(() => undefined)
  try {
    await send(
      createToolLoopTransport({
        store,
        providerID,
        model,
        effectiveModelID: modelID,
        maxOutputTokens: 100,
        thinkingLevel: () => level,
        diagnosticContext: { sessionId: 'conversation', runId: 'run' },
        recorder
      })
    )
  } finally {
    consoleError.mockRestore()
    store.dispose()
  }
  await recorder.flush()
  expect(bodies).toHaveLength(1)
  const body = v.parse(RequestBody, bodies[0])
  // The trace reports caching only when the request carries it.
  expect(expectDefined(traces.runs.get('run')).settings.cache).toBe('cache_control' in body)
  return body
}

const EPHEMERAL = { type: 'ephemeral' }

test('Claude on OpenRouter is cached alongside a non-default reasoning effort', async () => {
  const body = await serializedRequest('openrouter', 'anthropic/claude-sonnet-4.6', 'low')
  expect(body.cache_control).toEqual(EPHEMERAL)
  expect(body.reasoning).toEqual({ effort: 'low' })
})

test('Claude on OpenRouter is cached at the default reasoning effort', async () => {
  const body = await serializedRequest('openrouter', 'anthropic/claude-sonnet-4.6', 'default')
  expect(body.cache_control).toEqual(EPHEMERAL)
  expect(body.reasoning).toBeUndefined()
})

test('OpenRouter models with automatic caching get no cache marker', async () => {
  const body = await serializedRequest('openrouter', 'openai/gpt-5.2', 'high')
  expect(body.cache_control).toBeUndefined()
  expect(body.reasoning).toEqual({ effort: 'high' })
})

test.each(['anthropic', 'anthropic-compatible'] as const)(
  '%s requests are cached alongside extended thinking',
  async (providerID) => {
    const body = await serializedRequest(providerID, 'claude-sonnet-4-5', 'high')
    expect(body.cache_control).toEqual(EPHEMERAL)
    expect(body.thinking).toMatchObject({ type: 'enabled' })
  }
)

test('Z.AI caches automatically and gets no cache marker', async () => {
  const body = await serializedRequest('zai', 'glm-4.6', 'default')
  expect(body.cache_control).toBeUndefined()
})
