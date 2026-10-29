import 'fake-indexeddb/auto'
import { afterEach, expect, spyOn, test } from 'bun:test'

import { readUIMessageStream, simulateReadableStream } from 'ai'
import type { UIMessage } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'

import { FigmaAPI } from '@open-pencil/core/figma-api'

import { matchesRecordedStep, rebuildStepMessages } from '@/app/ai/chat/trace/rebuild'
import { createRunRecorder } from '@/app/ai/chat/trace/recorder'
import { createAITools } from '@/app/ai/tools'
import { aiToolOverrides } from '@/app/ai/tools/preferences'
import { createToolLoopTransport } from '@/app/ai/transports/tool-loop'
import * as figmaFactory from '@/app/automation/bridge/figma-factory'
import { createEditorStore } from '@/app/editor/session/create'

import { expectDefined } from '#tests/helpers/assert'
import { memoryTraceStore } from '#tests/helpers/chat/trace-store'
import { MOCK_USAGE } from '#tests/helpers/chat/usage'

type StreamChunk =
  Awaited<ReturnType<MockLanguageModelV4['doStream']>>['stream'] extends ReadableStream<infer Chunk>
    ? Chunk
    : never

const rectangle = (id: string, x: number): StreamChunk[] => [
  {
    type: 'tool-call',
    toolCallId: id,
    toolName: 'create_shape',
    input: JSON.stringify({ type: 'RECTANGLE', x, y: 0, width: 10, height: 10 })
  },
  { type: 'finish', finishReason: { unified: 'tool-calls', raw: undefined }, usage: MOCK_USAGE }
]

const STEPS: StreamChunk[][] = [
  rectangle('call-a', 0),
  [
    { type: 'reasoning-start', id: 'think' },
    { type: 'reasoning-delta', id: 'think', delta: 'One more beside it.' },
    { type: 'reasoning-end', id: 'think' },
    ...rectangle('call-b', 20)
  ],
  [
    { type: 'text-start', id: 'reply' },
    { type: 'text-delta', id: 'reply', delta: 'Drew two rectangles.' },
    { type: 'text-end', id: 'reply' },
    { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage: MOCK_USAGE }
  ]
]

const previousTools = aiToolOverrides.value
afterEach(() => {
  aiToolOverrides.value = previousTools
})

test('every recorded step rebuilds from the conversation to the request the model received', async () => {
  const store = createEditorStore()
  spyOn(figmaFactory, 'makeFigmaFromStore').mockImplementation((editor, pageId) => {
    const api = new FigmaAPI(editor.graph)
    api.currentPage = api.wrapNode(pageId ?? editor.state.currentPageId)
    return api
  })
  store.preparationController.acknowledgePresentation(Number.MAX_SAFE_INTEGER)
  aiToolOverrides.value = { create_shape: true }

  let call = 0
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream<StreamChunk>({
        initialDelayInMs: null,
        chunkDelayInMs: null,
        chunks: STEPS[call++] ?? []
      })
    })
  })
  const traces = memoryTraceStore()
  const recorder = createRunRecorder(traces.store)
  const transport = createToolLoopTransport({
    store,
    providerID: 'openai',
    model,
    effectiveModelID: 'test',
    maxOutputTokens: 100,
    thinkingLevel: () => 'default',
    diagnosticContext: { sessionId: 'conversation', runId: 'run' },
    recorder
  })
  const earlier: UIMessage[] = [
    { id: 'first', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
    { id: 'answer', role: 'assistant', parts: [{ type: 'text', text: 'Hi' }] },
    { id: 'request', role: 'user', parts: [{ type: 'text', text: 'Draw two rectangles' }] }
  ]
  const stream = await transport.sendMessages({
    trigger: 'submit-message',
    chatId: 'conversation',
    messageId: undefined,
    abortSignal: undefined,
    messages: earlier
  })
  let reply: UIMessage | undefined
  for await (const message of readUIMessageStream({ stream })) reply = message
  await recorder.flush()

  const run = expectDefined(traces.runs.get('run'))
  expect(run.outcome).toBe('completed')
  expect(run.input).toEqual({ through: 'request', messages: 3 })
  expect(run.steps.map((step) => step.response.finishReason)).toEqual([
    'tool-calls',
    'tool-calls',
    'stop'
  ])
  expect(traces.assets.get(run.instructions)?.kind).toBe('instructions')
  expect(traces.assets.get(expectDefined(run.tools))).toMatchObject({
    kind: 'tools',
    tools: expect.arrayContaining([expect.objectContaining({ name: 'create_shape' })])
  })

  const conversation = [...earlier, expectDefined(reply)]
  const tools = createAITools(store)
  for (const step of run.steps) {
    expect(await matchesRecordedStep(conversation, run, step.index, tools)).toBe(true)
  }
  expect(run.steps.map((step) => step.request.messages)).toEqual([3, 5, 7])
  // A conversation that changed since no longer rebuilds to what was sent.
  const edited = conversation.with(2, {
    id: 'request',
    role: 'user',
    parts: [{ type: 'text', text: 'Draw three rectangles' }]
  })
  expect(await matchesRecordedStep(edited, run, 0, tools)).toBe(false)
  // The last step saw both tool calls and their results.
  const last = await rebuildStepMessages(conversation, run, 2, tools)
  expect(last.filter((message) => message.role === 'tool')).toHaveLength(2)
})
