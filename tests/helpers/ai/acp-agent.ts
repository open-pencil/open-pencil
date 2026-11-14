import {
  agent as acpAgent,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
  RequestError,
  type AgentConnection,
  type ClientCapabilities,
  type NewSessionRequest,
  type ResumeSessionRequest,
  type SessionUpdate,
  type StopReason
} from '@agentclientprotocol/sdk/unstable'
import type { UIMessage, UIMessageChunk } from 'ai'

import { ACP_AGENTS, type ACPAgentDef } from '@open-pencil/core/constants'
import { expectDefined } from '@open-pencil/test-support/assert'

import { OWN_TOOLS_ALLOWED } from '@/app/ai/agents/acp/tools'
import { ACPChatTransport, type ACPStartup } from '@/app/ai/transports/acp'
import { createDeferred } from '@/app/runtime/deferred'

export const resuming = expectDefined(
  ACP_AGENTS.find((agent) => agent.resumesSessions),
  'an agent that resumes sessions'
)

interface FakeAgentOptions {
  /** False for an agent that runs but never answers a new session. */
  answersSessions?: boolean
  /** Refuses every resume, as for a session the agent no longer has. */
  resumeFails?: boolean
  /** An adapter error that the real ACP connection serializes before the client receives it. */
  resumeError?: Error
  /** A temporary refusal on the first resume, as when the old process still owns the session. */
  resumeBusy?: boolean
  /** True for an automation token that is never read, as with a credential prompt left open. */
  tokenHangs?: boolean
  /**
   * How the agent's turn ends: `refused` fails before the agent takes the prompt, `cut-off` fails
   * after it started answering. Either way it first sends updates that are not part of a turn.
   * `held` takes each prompt and answers it only when `endTurn` says so, or when it is cancelled.
   */
  turn?: 'answered' | 'refused' | 'cut-off' | 'held'
  /** True for a command lookup that waits until `finishLookup`, as a slow PATH search does. */
  lookupWaits?: boolean
  /**
   * What the agent reports while it takes a turn, after its command list: in the turn's session,
   * or in a subagent's session `session`.
   */
  updates?: { session?: string; update: SessionUpdate }[]
}

/** In-memory ACP agents, one per start, that record what the transport asks of them. */
export function fakeAgents({
  answersSessions = true,
  resumeFails = false,
  resumeError,
  resumeBusy = false,
  tokenHangs = false,
  turn = 'answered',
  lookupWaits = false,
  updates = []
}: FakeAgentOptions = {}) {
  const lookup = createDeferred<undefined>()
  const prompts: string[] = []
  const created: NewSessionRequest[] = []
  const resumed: ResumeSessionRequest[] = []
  const capabilities: (ClientCapabilities | undefined)[] = []
  const sessionRequested = createDeferred<undefined>()
  const killed = createDeferred<undefined>()
  let kills = 0
  let spawns = 0
  const searchPaths: (string | null | undefined)[] = []
  const defersTools: boolean[] = []
  const cwds: (string | undefined)[] = []
  let crashLatest: (() => void) | null = null
  const cancels: string[] = []
  const promptTaken = createDeferred<undefined>()
  // Each held prompt waits on its own signal, so one cancelled or ended never frees a later one.
  let heldTurn = createDeferred<StopReason>()
  const promptWaiters: { count: number; taken: () => void }[] = []
  let latest: AgentConnection | null = null
  let promptedSession = ''

  const spawn: ACPStartup['spawn'] = async (options) => {
    spawns++
    searchPaths.push(options.searchPath)
    cwds.push(options.cwd)
    const toAgent = new TransformStream<Uint8Array, Uint8Array>()
    const toClient = new TransformStream<Uint8Array, Uint8Array>()
    latest = acpAgent()
      .onRequest(methods.agent.initialize, ({ params }) => {
        capabilities.push(params.clientCapabilities)
        return {
          protocolVersion: PROTOCOL_VERSION,
          agentCapabilities: { sessionCapabilities: { resume: {} } }
        }
      })
      .onRequest(methods.agent.session.new, ({ params }) => {
        created.push(params)
        sessionRequested.resolve(undefined)
        if (!answersSessions) return createDeferred<never>().promise
        return { sessionId: `session-${created.length}` }
      })
      .onRequest(methods.agent.session.resume, ({ params }) => {
        resumed.push(params)
        if (resumeFails) throw RequestError.resourceNotFound(params.sessionId)
        if (resumeError) throw resumeError
        if (resumeBusy && resumed.length === 1)
          throw RequestError.invalidRequest({ reason: 'thread_active_writer' }, 'Session in use')
        return {}
      })
      .onRequest(methods.agent.session.prompt, async ({ params, client }) => {
        const [part] = params.prompt
        prompts.push(part?.type === 'text' ? part.text : '')
        const { sessionId } = params
        promptedSession = sessionId
        const held = createDeferred<StopReason>()
        heldTurn = held
        for (const waiter of promptWaiters) if (prompts.length >= waiter.count) waiter.taken()
        const report = (update: SessionUpdate, session = sessionId) =>
          client.notify(methods.client.session.update, { sessionId: session, update })
        await report({ sessionUpdate: 'available_commands_update', availableCommands: [] })
        promptTaken.resolve(undefined)
        if (turn === 'held') return { stopReason: await held.promise }
        if (turn === 'refused') throw new Error('The prompt never reached the model')
        for (const { session, update } of updates) await report(update, session)
        if (turn === 'cut-off') {
          await report({
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'On it' }
          })
          throw new Error('The turn broke off')
        }
        return { stopReason: 'end_turn' }
      })
      .onRequest(methods.agent.authenticate, () => ({}))
      .onNotification(methods.agent.session.cancel, ({ params }) => {
        cancels.push(params.sessionId)
        // Agents answer a cancelled turn with its stop reason.
        heldTurn.resolve('cancelled')
      })
      .connect(ndJsonStream(toClient.writable, toAgent.readable))
    // Ending the pipe ends what the client reads, as a process that exits does.
    const output = new TransformStream<Uint8Array, Uint8Array>()
    const stop = new AbortController()
    toClient.readable
      .pipeTo(output.writable, { signal: stop.signal, preventCancel: true })
      .catch(() => undefined)
    crashLatest = () => {
      // What the process pipe reports when the agent exits (`src/app/ai/agents/acp/process.ts`).
      stop.abort(new Error('Agent process exited unexpectedly.'))
      options.onUnexpectedClose()
    }
    return {
      child: {
        write: async () => undefined,
        kill: async () => {
          kills++
          stop.abort()
          killed.resolve(undefined)
        }
      },
      input: toAgent.writable,
      output: output.readable
    }
  }

  const startup: ACPStartup = {
    resolveTarget: async (agent) => {
      if (lookupWaits) await lookup.promise
      return { command: agent.command, searchPath: '/lookup/bin' }
    },
    spawn,
    authToken: async () => (tokenHangs ? createDeferred<never>().promise : null),
    linkTools: async (_token, linkOptions) => {
      defersTools.push(linkOptions?.defersTools ?? false)
      return {
        chat: 'chat',
        mcpServers: [],
        meta: OWN_TOOLS_ALLOWED,
        noteUpdate: () => undefined,
        outcome: async () => ({ connected: true }),
        stop: () => undefined
      }
    }
  }
  return {
    startup,
    prompts,
    created,
    resumed,
    capabilities,
    sessionRequested: sessionRequested.promise,
    killed: killed.promise,
    kills: () => kills,
    spawns: () => spawns,
    searchPaths,
    cwds,
    defersTools,
    finishLookup: () => lookup.resolve(undefined),
    crash: () => expectDefined(crashLatest, 'a started agent')(),
    cancels,
    promptTaken: promptTaken.promise,
    /** Settles once the agent has taken `count` prompts in all, for a later prompt of a session. */
    promptsTaken: (count: number) =>
      new Promise<void>((resolve) => {
        if (prompts.length >= count) resolve()
        else promptWaiters.push({ count, taken: resolve })
      }),
    /** Sends an update as the agent's turn goes on. */
    say: (update: SessionUpdate) =>
      expectDefined(latest, 'a started agent').client.notify(methods.client.session.update, {
        sessionId: promptedSession,
        update
      }),
    endTurn: (stopReason: StopReason) => heldTurn.resolve(stopReason)
  }
}

export function message(role: UIMessage['role'], text: string): UIMessage {
  return { id: crypto.randomUUID(), role, parts: [{ type: 'text', text }] }
}

/**
 * Sends `text` after `history`, without waiting for the reply to end: `chunks` fills as it goes
 * and `ended` settles once the stream closes.
 */
export function sending(
  transport: ACPChatTransport,
  text: string,
  history: UIMessage[] = [],
  abortSignal?: AbortSignal
) {
  const chunks: UIMessageChunk[] = []
  const ended = (async () => {
    const reply = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'chat',
      messageId: undefined,
      messages: [...history, message('user', text)],
      abortSignal
    })
    await reply.pipeTo(new WritableStream({ write: (chunk) => void chunks.push(chunk) }))
  })()
  return { chunks, ended }
}

/** Sends `text` after `history` and waits for the reply to end. */
export async function send(
  transport: ACPChatTransport,
  text: string,
  history: UIMessage[] = [],
  abortSignal?: AbortSignal
): Promise<UIMessageChunk[]> {
  const reply = sending(transport, text, history, abortSignal)
  await reply.ended
  return reply.chunks
}

/** A task boundary, which runs everything the transport and the agent connection queued. */
export function tick() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

export function transport(
  agents: ReturnType<typeof fakeAgents>,
  options: {
    resume?: string
    startTimeoutMs?: number
    agentDef?: ACPAgentDef
    cwd?: string
    yieldWhen?: () => boolean
  } = {}
) {
  const sessions: (string | null)[] = []
  const agentErrors: unknown[] = []
  const created = new ACPChatTransport({
    agentDef: options.agentDef ?? resuming,
    cwd: options.cwd,
    startup: agents.startup,
    resume: options.resume,
    startTimeoutMs: options.startTimeoutMs ?? 1_000,
    yieldWhen: options.yieldWhen,
    onSession: (id) => sessions.push(id),
    onAgentError: (error) => agentErrors.push(error)
  })
  return { transport: created, sessions, agentErrors }
}
