import { expect, test } from 'bun:test'

import { readUIMessageStream, type UIMessage } from 'ai'
import * as v from 'valibot'

import type {
  HarnessSidecarMessage,
  HarnessTurnEvent,
  HarnessTurnUsage
} from '@open-pencil/harness'
import { expectDefined } from '@open-pencil/test-support/assert'

import {
  agentCompactionMessage,
  messagesSinceCompaction,
  replyCompactions
} from '@/app/ai/chat/compaction/marker'
import { HarnessChatTransport } from '@/app/ai/transports/pi'
test('failed session stop kills the process without deleting resume state', async () => {
  let output: ReadableStreamDefaultController<HarnessSidecarMessage> | undefined
  const methods: string[] = []
  let kills = 0
  const transport = new HarnessChatTransport(
    'test-session',
    {
      adapter: 'pi',
      sandbox: 'just-bash',
      model: 'test',
      settings: {},
      instructions: '',
      mcpServers: {}
    },
    {},
    async () => ({
      child: {
        write: async () => undefined,
        kill: async () => {
          kills++
          output?.close()
        }
      },
      messages: new ReadableStream({
        start(controller) {
          output = controller
        }
      }),
      send: async (request) => {
        if (
          !('id' in request) ||
          !('method' in request) ||
          typeof request.id !== 'string' ||
          typeof request.method !== 'string'
        )
          throw new Error('Invalid request')
        methods.push(request.method)
        output?.enqueue({
          type: 'response',
          id: request.id,
          ...(request.method === 'session.stop'
            ? { error: 'Resume storage failed' }
            : { result: {} })
        })
      }
    })
  )
  const stream = await transport.sendMessages({
    chatId: 'test',
    trigger: 'submit-message',
    messageId: undefined,
    messages: [{ id: 'user', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
    abortSignal: undefined
  })
  const reader = stream.getReader()
  while (!(await reader.read()).done) {
    /* Drain the completed turn. */
  }
  await expect(transport.stop()).rejects.toThrow('Resume storage failed')
  expect(kills).toBe(1)
  expect(methods).toContain('session.stop')
  expect(methods).not.toContain('session.destroy')
  await transport.stop()
  expect(kills).toBe(1)
})

const configuration = {
  adapter: 'pi',
  sandbox: 'just-bash',
  model: 'test',
  settings: {},
  instructions: '',
  mcpServers: {}
} as const

/**
 * A companion that answers session requests at once and holds each turn open, so the test
 * decides when its events and its answer arrive, as Pi's do after a Stop.
 */
const promptParams = v.object({ prompt: v.string() })

function fakeCompanion({ turnsFail = false } = {}) {
  let output: ReadableStreamDefaultController<HarnessSidecarMessage> | undefined
  const methods: string[] = []
  const turns: string[] = []
  const prompts: unknown[] = []
  let spawns = 0
  const spawn = async () => {
    spawns++
    return {
      child: { write: async () => undefined, kill: async () => output?.close() },
      messages: new ReadableStream<HarnessSidecarMessage>({
        start(controller) {
          output = controller
        }
      }),
      send: async (request: object) => {
        if (!('id' in request) || !('method' in request)) throw new Error('Invalid request')
        const { id, method } = request
        if (typeof id !== 'string' || typeof method !== 'string') throw new Error('Invalid request')
        methods.push(method)
        if (method === 'session.turn' && turnsFail) throw new Error('Pipe closed')
        if (method === 'session.turn') {
          turns.push(id)
          if ('params' in request && v.is(promptParams, request.params))
            prompts.push(request.params.prompt)
        } else output?.enqueue({ type: 'response', id, result: {} })
      }
    }
  }
  return {
    spawn,
    methods,
    get spawns() {
      return spawns
    },
    /** The turn's next event or its final answer, as the companion would send it. */
    text: (turn: string, text: string) =>
      output?.enqueue({ type: 'turn.event', id: turn, event: { type: 'text-delta', text } }),
    event: (turn: string, event: HarnessTurnEvent) =>
      output?.enqueue({ type: 'turn.event', id: turn, event }),
    complete: (turn: string) =>
      output?.enqueue({ type: 'response', id: turn, result: { completed: true } }),
    finish: (turn: string, usage?: HarnessTurnUsage) =>
      output?.enqueue({
        type: 'turn.event',
        id: turn,
        event: { type: 'finish', finishReason: 'stop', ...(usage ? { usage } : {}) }
      }),
    turns,
    prompts
  }
}

function send(transport: HarnessChatTransport, abortSignal?: AbortSignal) {
  return transport.sendMessages({
    chatId: 'test',
    trigger: 'submit-message',
    messageId: undefined,
    messages: [{ id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: 'Hi' }] }],
    abortSignal
  })
}

test('stopping a turn keeps the session, and its late events and answer are ignored', async () => {
  const companion = fakeCompanion()
  const transport = new HarnessChatTransport('stop-session', configuration, {}, companion.spawn)
  const stop = new AbortController()
  const reader = (await send(transport, stop.signal)).getReader()
  await Promise.resolve()
  const [first = ''] = companion.turns
  companion.text(first, 'one')

  // As the AI SDK's Chat.stop does: abort the request, then drop the reader.
  stop.abort()
  await reader.cancel()
  companion.text(first, 'two')
  companion.complete(first)
  await Promise.resolve()

  const next = (await send(transport)).getReader()
  await Promise.resolve()
  const second = companion.turns.at(1) ?? ''
  companion.text(second, 'pong')
  companion.complete(second)
  const chunks: string[] = []
  for (let read = await next.read(); !read.done; read = await next.read()) {
    if (read.value.type === 'text-delta') chunks.push(read.value.delta)
  }

  expect(chunks).toEqual(['pong'])
  expect(companion.spawns).toBe(1)
  expect(companion.methods.filter((method) => method === 'session.create')).toHaveLength(1)
  expect(companion.methods.filter((method) => method === 'session.cancel')).toHaveLength(1)
  await transport.destroy()
})

test('stopping a turn that already ended does not cancel the next one', async () => {
  const companion = fakeCompanion()
  const transport = new HarnessChatTransport('late-stop', configuration, {}, companion.spawn)
  const stop = new AbortController()
  const reader = (await send(transport, stop.signal)).getReader()
  await Promise.resolve()
  companion.complete(companion.turns[0] ?? '')
  while (!(await reader.read()).done);

  const next = (await send(transport)).getReader()
  await Promise.resolve()
  stop.abort()
  const second = companion.turns.at(1) ?? ''
  companion.text(second, 'pong')
  companion.complete(second)
  const chunks: string[] = []
  for (let read = await next.read(); !read.done; read = await next.read()) {
    if (read.value.type === 'text-delta') chunks.push(read.value.delta)
  }

  expect(chunks).toEqual(['pong'])
  expect(companion.methods).not.toContain('session.cancel')
  await transport.destroy()
})

test('a turn the companion could not be sent ends with an error', async () => {
  const companion = fakeCompanion({ turnsFail: true })
  const transport = new HarnessChatTransport('broken-pipe', configuration, {}, companion.spawn)
  const reader = (await send(transport)).getReader()
  const types: string[] = []
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    types.push(read.value.type)
  }

  expect(types.at(-1)).toBe('error')
  await transport.destroy()
})

test("reports each turn's tokens, which older companions do not send", async () => {
  const companion = fakeCompanion()
  const reported: HarnessTurnUsage[] = []
  const transport = new HarnessChatTransport(
    'usage-session',
    configuration,
    {},
    companion.spawn,
    (usage) => reported.push(usage)
  )
  const usage = { inputTokens: 1200, outputTokens: 40, cacheReadTokens: 1000, cacheWriteTokens: 0 }
  for (const turnUsage of [usage, undefined]) {
    const reader = (await send(transport)).getReader()
    await Promise.resolve()
    const turn = companion.turns.at(-1) ?? ''
    companion.finish(turn, turnUsage)
    companion.complete(turn)
    while (!(await reader.read()).done) {
      /* Drain the turn. */
    }
  }
  expect(reported).toEqual([usage])
  await transport.destroy()
})

test('text after a tool call starts a new part, and a stopped turn closes its text', async () => {
  const companion = fakeCompanion()
  const transport = new HarnessChatTransport('parts-session', configuration, {}, companion.spawn)
  const stop = new AbortController()
  const reader = (await send(transport, stop.signal)).getReader()
  await Promise.resolve()
  const turn = companion.turns.at(-1) ?? ''
  companion.text(turn, 'Looking.')
  companion.event(turn, {
    type: 'tool-call',
    toolCallId: 'call-1',
    toolName: 'mcp_open-pencil_get_page_tree',
    input: {}
  })
  companion.event(turn, {
    type: 'tool-result',
    toolCallId: 'call-1',
    toolName: 'mcp_open-pencil_get_page_tree',
    output: {}
  })
  companion.text(turn, 'Done')
  const types: string[] = []
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    types.push(read.value.type)
    // Stop once the second text arrived, as the person would while it streams.
    if (types.filter((type) => type === 'text-delta').length === 2) stop.abort()
  }
  expect(types.filter((type) => type === 'text-start')).toHaveLength(2)
  expect(types.filter((type) => type === 'text-end')).toHaveLength(2)
  expect(types.at(-1)).toBe('finish')
  await transport.destroy()
})

test('compacting asks Pi to, and a turn keeps each compaction Pi runs in it', async () => {
  const companion = fakeCompanion()
  const transport = new HarnessChatTransport('compact-session', configuration, {}, companion.spawn)
  // Before any turn there is no context to compact.
  expect(await transport.compact()).toBe(false)

  const first = (await send(transport)).getReader()
  await Promise.resolve()
  const firstTurn = companion.turns.at(-1) ?? ''
  companion.text(firstTurn, 'Hi')
  companion.complete(firstTurn)
  while (!(await first.read()).done);
  expect(await transport.compact('keep the colors')).toBe(true)
  expect(companion.methods).toContain('session.compact')

  // The chat draws its own divider for it, which is not the person's message to send.
  const stream = await transport.sendMessages({
    chatId: 'test',
    trigger: 'submit-message',
    messageId: undefined,
    messages: [
      { id: 'hi', role: 'user', parts: [{ type: 'text', text: 'Hi' }] },
      { id: 'answer', role: 'assistant', parts: [{ type: 'text', text: 'Hello' }] },
      agentCompactionMessage('manual'),
      { id: 'again', role: 'user', parts: [{ type: 'text', text: 'Again' }] }
    ],
    abortSignal: undefined
  })
  await Promise.resolve()
  expect(companion.prompts.at(-1)).toBe('Again')
  const turn = companion.turns.at(-1) ?? ''
  // A manual compaction Pi reports later is the one the chat drew already.
  companion.event(turn, {
    type: 'compaction',
    trigger: 'manual',
    summary: 'Greeted.',
    tokensBefore: 1200
  })
  companion.text(turn, 'Hello again')
  // A long turn can fill the context; the reply keeps every compaction Pi runs in it.
  companion.event(turn, {
    type: 'compaction',
    trigger: 'auto',
    summary: 'Greeted twice.',
    tokensBefore: 3400
  })
  companion.text(turn, 'And again')
  companion.event(turn, {
    type: 'compaction',
    trigger: 'auto',
    summary: 'Greeted thrice.',
    tokensBefore: 3500
  })
  companion.text(turn, 'And once more')
  companion.complete(turn)
  let reply: UIMessage | undefined
  for await (const message of readUIMessageStream({ stream })) reply = message
  const message = expectDefined(reply)
  expect(replyCompactions(message)).toEqual([
    { summary: 'Greeted twice.', trigger: 'auto', tokensBefore: 3400, step: 1 },
    { summary: 'Greeted thrice.', trigger: 'auto', tokensBefore: 3500, step: 2 }
  ])
  // The latest summary stands before the step that followed it.
  const next = messagesSinceCompaction([message])
  expect(next.map((entry) => entry.role)).toEqual(['user', 'assistant'])
  expect(JSON.stringify(next[0])).toContain('Greeted thrice.')
  expect(JSON.stringify(next[1])).toContain('And once more')
  expect(JSON.stringify(next[1])).not.toContain('And again')
  await transport.destroy()
})
