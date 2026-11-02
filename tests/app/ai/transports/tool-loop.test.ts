import 'fake-indexeddb/auto'
import { expect, spyOn, test } from 'bun:test'

import { simulateReadableStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import * as v from 'valibot'

import type { AIProviderID } from '@open-pencil/core/constants'
import { FigmaAPI } from '@open-pencil/core/figma-api'

import { createRunRecorder } from '@/app/ai/chat/trace/recorder'
import type { ThinkingLevel } from '@/app/ai/models/types'
import { modelProviderAdapter } from '@/app/ai/providers/registry'
import type { Skill } from '@/app/ai/skills/types'
import { aiToolOverrides } from '@/app/ai/tools/preferences'
import { createToolLoopTransport } from '@/app/ai/transports/tool-loop'
import * as figmaFactory from '@/app/automation/bridge/figma-factory'
import { createEditorStore } from '@/app/editor/session/create'

import { expectDefined } from '#tests/helpers/assert'
import { skillFixture } from '#tests/helpers/chat/skills'
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

test('enabled skills reach the model as a listing and the tools that load them', async () => {
  const store = createEditorStore()
  const model = replyModel()
  // Each message reads the skills again; the second finds none left.
  const reads: Skill[][] = [[skillFixture()], []]
  let enabled: Skill[] = []
  try {
    const transport = createToolLoopTransport({
      store,
      providerID: 'anthropic',
      model,
      effectiveModelID: 'claude-test',
      maxOutputTokens: 100,
      thinkingLevel: () => 'default',
      skills: {
        refresh: async () => {
          enabled = reads.shift() ?? []
        },
        enabled: () => enabled
      }
    })
    await send(transport)
    await send(transport)
    const [withSkills, without] = model.doStreamCalls.map((call) => ({
      system: call.prompt.flatMap((message) =>
        message.role === 'system' ? [message.content] : []
      ),
      tools: (call.tools ?? []).map((tool) => tool.name)
    }))
    expect(withSkills?.system.join('\n')).toContain('<name>grid</name>')
    expect(withSkills?.tools).toEqual(expect.arrayContaining(['load_skill', 'read_skill_file']))
    expect(without?.system.join('\n')).not.toContain('<name>grid</name>')
    expect(without?.tools).not.toContain('load_skill')
  } finally {
    store.dispose()
  }
})

test('skills the user runs only by name are neither listed nor loadable', async () => {
  const store = createEditorStore()
  const model = replyModel()
  const manual = skillFixture({ name: 'release', modelInvocable: false })
  try {
    const transport = createToolLoopTransport({
      store,
      providerID: 'anthropic',
      model,
      effectiveModelID: 'claude-test',
      maxOutputTokens: 100,
      thinkingLevel: () => 'default',
      skills: { refresh: async () => undefined, enabled: () => [manual] }
    })
    await send(transport)
    const [call] = model.doStreamCalls
    expect((call?.tools ?? []).map((tool) => tool.name)).not.toContain('load_skill')
    expect(JSON.stringify(call?.prompt)).not.toContain('release')
  } finally {
    store.dispose()
  }
})

test('a waiting message ends the run once the current tool calls finish', async () => {
  const previousTools = aiToolOverrides.value
  const store = createEditorStore()
  const factory = spyOn(figmaFactory, 'makeFigmaFromStore').mockImplementation(
    (editor) => new FigmaAPI(editor.graph)
  )
  let calls = 0
  const model = new MockLanguageModelV4({
    doStream: async () => {
      calls++
      return {
        stream: simulateReadableStream({
          initialDelayInMs: null,
          chunkDelayInMs: null,
          chunks: [
            {
              type: 'tool-call',
              toolCallId: `call-${calls}`,
              toolName: 'get_selection',
              input: '{}'
            },
            {
              type: 'finish',
              finishReason: { unified: 'tool-calls', raw: undefined },
              usage: MOCK_USAGE
            }
          ]
        })
      }
    }
  })
  let waiting = false
  try {
    aiToolOverrides.value = {}
    const transport = createToolLoopTransport({
      store,
      providerID: 'openai',
      model,
      effectiveModelID: 'test',
      maxOutputTokens: 100,
      thinkingLevel: () => 'default',
      yieldWhen: () => waiting
    })
    waiting = true
    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'steer',
      messageId: undefined,
      messages: [{ id: 'user', role: 'user', parts: [{ type: 'text', text: 'Inspect' }] }],
      abortSignal: undefined
    })
    const reader = stream.getReader()
    const types: string[] = []
    try {
      while (true) {
        const next = await reader.read()
        if (next.done) break
        types.push(next.value.type)
      }
    } finally {
      reader.releaseLock()
    }
    // One model step: its tool call ran and has its result, then the run gave way.
    expect(calls).toBe(1)
    expect(types).toContain('tool-output-available')
  } finally {
    aiToolOverrides.value = previousTools
    factory.mockRestore()
    store.dispose()
  }
})
