import * as v from 'valibot'

import type {
  HarnessSidecarMessage,
  HarnessTurnEvent,
  HarnessTurnUsage
} from '@open-pencil/harness'

import type { HarnessChatTransport } from '@/app/ai/transports/pi'

export const configuration = {
  adapter: 'pi',
  sandbox: 'just-bash',
  model: 'test',
  settings: {},
  instructions: '',
  mcpServers: {}
} as const

const promptParams = v.object({ prompt: v.string() })

/**
 * A companion that answers session requests at once and holds each turn open, so the test
 * decides when its events and its answer arrive, as Pi's do after a Stop.
 */
export function fakeCompanion({ turnsFail = false, createWaits = false } = {}) {
  let output: ReadableStreamDefaultController<HarnessSidecarMessage> | undefined
  const methods: string[] = []
  /** The session starts the companion has not answered yet, which `finishCreate` answers. */
  const unanswered: string[] = []
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
        } else if (method === 'session.create' && createWaits) unanswered.push(id)
        else output?.enqueue({ type: 'response', id, result: {} })
      }
    }
  }
  return {
    spawn,
    methods,
    finishCreate: () => {
      for (const id of unanswered.splice(0)) output?.enqueue({ type: 'response', id, result: {} })
    },
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
    /** How many times the transport asked the companion to cancel a turn. */
    get cancels() {
      return methods.filter((method) => method === 'session.cancel').length
    },
    turns,
    prompts
  }
}

export function send(transport: HarnessChatTransport, abortSignal?: AbortSignal) {
  return transport.sendMessages({
    chatId: 'test',
    trigger: 'submit-message',
    messageId: undefined,
    messages: [{ id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: 'Hi' }] }],
    abortSignal
  })
}
