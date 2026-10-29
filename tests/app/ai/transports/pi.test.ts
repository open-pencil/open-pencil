import { expect, test } from 'bun:test'

import type {
  HarnessSidecarMessage,
  HarnessTurnEvent,
  HarnessTurnUsage
} from '@open-pencil/harness'

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
function fakeCompanion({ turnsFail = false } = {}) {
  let output: ReadableStreamDefaultController<HarnessSidecarMessage> | undefined
  const methods: string[] = []
  const turns: string[] = []
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
        if (method === 'session.turn') turns.push(id)
        else output?.enqueue({ type: 'response', id, result: {} })
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
    turns
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
