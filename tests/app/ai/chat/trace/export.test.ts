import { beforeEach, expect, test } from 'bun:test'

import type { UIMessage } from 'ai'
import * as v from 'valibot'

import type { Conversation } from '@/app/ai/chat/history/types'
import { chatTrace } from '@/app/ai/chat/trace/export'
import type { RunTrace } from '@/app/ai/chat/trace/types'
import { diagnostics, recordChatCompleted, recordModelStepCompleted } from '@/app/diagnostics'

import { memoryTraceStore } from '#tests/helpers/chat/trace-store'

const traceSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    environment: v.object({ app: v.string(), shell: v.string() }),
    conversation: v.record(v.string(), v.unknown()),
    messages: v.array(
      v.object({ message: v.looseObject({ id: v.string(), parts: v.array(v.unknown()) }) })
    ),
    runs: v.array(v.looseObject({ runId: v.string(), instructions: v.string() })),
    assets: v.record(v.string(), v.looseObject({ kind: v.string() })),
    events: v.array(v.object({ name: v.string(), sessionId: v.optional(v.string()) }))
  })
)

function recordedRun(conversationId: string, runId: string): RunTrace {
  return {
    conversationId,
    runId,
    startedAt: '2026-10-13T10:01:00.000Z',
    model: { provider: 'openrouter', id: 'anthropic/claude-sonnet-4.6' },
    settings: { maxOutputTokens: 16000, maxSteps: 25, thinking: 'default', cache: true },
    instructions: `sha256:${runId}-instructions`,
    input: { through: 'request', messages: 1 },
    steps: [],
    outcome: 'completed'
  }
}

const conversation: Conversation = {
  id: 'conversation-one',
  documentId: 'document',
  documentName: 'Untitled',
  title: 'Queue screen',
  titleSource: 'manual',
  createdAt: '2026-10-13T10:00:00.000Z',
  updatedAt: '2026-10-13T10:05:00.000Z',
  profileId: null,
  backend: 'direct',
  interrupted: false,
  messages: []
}

const messages: UIMessage[] = [
  { id: 'request', role: 'user', parts: [{ type: 'text', text: 'Add a queue screen' }] },
  {
    id: 'reply',
    role: 'assistant',
    parts: [
      { type: 'reasoning', text: 'Reading the player first.' },
      {
        type: 'tool-eval',
        toolCallId: 'call-1',
        state: 'output-available',
        input: { code: 'figma.currentPage.children.length' },
        output: { result: 3 }
      },
      { type: 'text', text: 'Added the queue screen.' }
    ]
  }
]

beforeEach(async () => {
  await diagnostics.clear()
})

test('a trace keeps every message part and its conversation’s runs and events', async () => {
  const run = { sessionId: conversation.id, runId: 'run-one' }
  recordModelStepCompleted(
    {
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4.6',
      inputTokens: 10,
      outputTokens: 2,
      cacheReadTokens: null,
      cacheWriteTokens: null
    },
    run
  )
  recordChatCompleted({ finishReason: 'stop' }, run)
  recordChatCompleted({ finishReason: 'stop' }, { sessionId: 'another', runId: 'run-two' })

  const traces = memoryTraceStore()
  const own = recordedRun(conversation.id, 'run-one')
  await traces.store.putRun(own)
  await traces.store.putAsset(own.instructions, { kind: 'instructions', text: 'Design well.' })
  const other = recordedRun('another', 'run-two')
  await traces.store.putRun(other)
  await traces.store.putAsset(other.instructions, { kind: 'instructions', text: 'Other.' })

  const trace = v.parse(traceSchema, await chatTrace(conversation, messages, traces.store))

  expect(trace.conversation).toMatchObject({ id: conversation.id, title: 'Queue screen' })
  expect(trace.conversation).not.toHaveProperty('messages')
  expect<unknown[]>(trace.messages.map((row) => row.message)).toEqual(messages)
  // Both events can share a millisecond, so their order is not part of the contract.
  expect(trace.events.map((event) => event.name).toSorted()).toEqual([
    'chat.completed',
    'model.step.completed'
  ])
  expect(trace.events.every((event) => event.sessionId === conversation.id)).toBe(true)
  // Only this conversation's runs, and only the assets they use.
  expect(trace.runs.map((entry) => entry.runId)).toEqual(['run-one'])
  expect(trace.assets).toEqual({
    [own.instructions]: { kind: 'instructions', text: 'Design well.' }
  })
})
