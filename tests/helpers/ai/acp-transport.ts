import {
  agent as acpAgent,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
  RequestError,
  type ClientCapabilities,
  type NewSessionRequest,
  type ResumeSessionRequest,
  type SessionConfigOption,
  type SessionUpdate
} from '@agentclientprotocol/sdk/unstable'
import type { UIMessage, UIMessageChunk } from 'ai'

import { ACP_AGENTS, type ACPAgentDef } from '@open-pencil/core/constants'
import { createDeferred } from '@open-pencil/std/async'
import { expectDefined } from '@open-pencil/test-support/assert'

import type { AgentChoices, AgentModelChoices } from '@/app/ai/agents/acp/options'
import { AGENT_SESSION_META } from '@/app/ai/agents/acp/tools'
import { ACPChatTransport, type ACPStartup } from '@/app/ai/transports/acp'

import { agentPipes } from './fake-acp-agent'

/** In-memory ACP agents behind a chat transport, for tests of what the transport asks of them. */

export const resuming = expectDefined(
  ACP_AGENTS.find((agent) => agent.resumesSessions),
  'an agent that resumes sessions'
)
export const codex = expectDefined(
  ACP_AGENTS.find((agent) => agent.id === 'codex'),
  'Codex agent'
)

export interface FakeAgentOptions {
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
   */
  turn?: 'answered' | 'refused' | 'cut-off'
  /** True for a command lookup that waits until `finishLookup`, as a slow PATH search does. */
  lookupWaits?: boolean
  /**
   * What the agent reports while it takes a turn, after its command list: in the turn's session,
   * or in a subagent's session `session`.
   */
  updates?: { session?: string; update: SessionUpdate }[]
  /** What the agent offers for choosing its model; none when absent. */
  configOptions?: SessionConfigOption[]
  /** Options the agent reports on its own while OpenPencil's tools connect. */
  startupOptions?: SessionConfigOption[]
  /** True to keep option changes waiting until `answerChoices`, as a slow agent does. */
  choicesWait?: boolean
  /** True for a turn that first asks permission for a tool and waits for the answer. */
  asksPermission?: boolean
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
  updates = [],
  configOptions,
  startupOptions,
  choicesWait = false,
  asksPermission = false
}: FakeAgentOptions = {}) {
  /** What the person answered the turn's permission request, or `cancelled`. */
  const permission = createDeferred<string>()
  const choices = createDeferred<undefined>()
  let notifyLatest: ((update: SessionUpdate) => Promise<void>) | null = null
  const startupNoted = createDeferred<undefined>()
  const lookup = createDeferred<undefined>()
  let offered = configOptions
  const prompts: string[] = []
  /** Model changes and prompts in the order the agent got them. */
  const calls: string[] = []
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

  const spawn: ACPStartup['spawn'] = async (options) => {
    spawns++
    searchPaths.push(options.searchPath)
    cwds.push(options.cwd)
    const { toAgent, toClient, output, stop } = agentPipes()
    acpAgent()
      .onRequest(methods.agent.initialize, ({ params }) => {
        capabilities.push(params.clientCapabilities)
        return {
          protocolVersion: PROTOCOL_VERSION,
          agentCapabilities: { sessionCapabilities: { resume: {} } }
        }
      })
      .onRequest(methods.agent.session.new, ({ params, client }) => {
        notifyLatest = (update) =>
          client.notify(methods.client.session.update, {
            sessionId: `session-${created.length}`,
            update
          })
        created.push(params)
        sessionRequested.resolve(undefined)
        if (!answersSessions) return createDeferred<never>().promise
        return { sessionId: `session-${created.length}`, configOptions }
      })
      .onRequest(methods.agent.session.resume, ({ params }) => {
        resumed.push(params)
        if (resumeFails) throw RequestError.resourceNotFound(params.sessionId)
        if (resumeError) throw resumeError
        if (resumeBusy && resumed.length === 1)
          throw RequestError.invalidRequest({ reason: 'thread_active_writer' }, 'Session in use')
        return {}
      })
      .onRequest(methods.agent.session.setConfigOption, async ({ params }) => {
        calls.push(`${params.configId} ${String(params.value)}`)
        if (choicesWait) await choices.promise
        // The session now runs on the value, and says so with the rest of its options.
        offered = offered?.map((option) =>
          option.id === params.configId && option.type === 'select'
            ? { ...option, currentValue: String(params.value) }
            : option
        )
        return { configOptions: offered ?? [] }
      })
      .onRequest(methods.agent.session.prompt, async ({ params, client }) => {
        const [part] = params.prompt
        calls.push('prompt')
        prompts.push(part?.type === 'text' ? part.text : '')
        const { sessionId } = params
        const report = (update: SessionUpdate, session = sessionId) =>
          client.notify(methods.client.session.update, { sessionId: session, update })
        await report({ sessionUpdate: 'available_commands_update', availableCommands: [] })
        if (turn === 'refused') throw new Error('The prompt never reached the model')
        if (asksPermission) {
          const { outcome } = await client.request(methods.client.session.requestPermission, {
            sessionId,
            toolCall: { toolCallId: 'tool-1', title: 'Approve Plan' },
            options: [{ optionId: 'allow', name: 'Allow', kind: 'allow_once' }]
          })
          permission.resolve(outcome.outcome === 'selected' ? outcome.optionId : outcome.outcome)
        }
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
      .onNotification(methods.agent.session.cancel, () => undefined)
      .connect(ndJsonStream(toClient.writable, toAgent.readable))
    crashLatest = () => {
      stop.abort()
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
        meta: AGENT_SESSION_META,
        noteUpdate: (update) => {
          if (update.sessionUpdate === 'config_option_update') startupNoted.resolve(undefined)
        },
        outcome: async () => {
          // Ends only once the transport has seen the update, so it arrives while tools connect.
          if (startupOptions) {
            const notify = expectDefined(notifyLatest, 'an opened session')
            await notify({ sessionUpdate: 'config_option_update', configOptions: startupOptions })
            await startupNoted.promise
          }
          return { connected: true }
        },
        stop: () => undefined
      }
    }
  }
  return {
    startup,
    prompts,
    calls,
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
    permissionAnswer: permission.promise,
    finishLookup: () => lookup.resolve(undefined),
    answerChoices: () => choices.resolve(undefined),
    crash: () => expectDefined(crashLatest, 'a started agent')()
  }
}

export function message(role: UIMessage['role'], text: string): UIMessage {
  return { id: crypto.randomUUID(), role, parts: [{ type: 'text', text }] }
}

/** Sends `text` after `history` and waits for the reply to end. */
export async function send(
  transport: ACPChatTransport,
  text: string,
  history: UIMessage[] = [],
  abortSignal?: AbortSignal
): Promise<UIMessageChunk[]> {
  const reply = await transport.sendMessages({
    trigger: 'submit-message',
    chatId: 'chat',
    messageId: undefined,
    messages: [...history, message('user', text)],
    abortSignal
  })
  const chunks: UIMessageChunk[] = []
  await reply.pipeTo(new WritableStream({ write: (chunk) => void chunks.push(chunk) }))
  return chunks
}

export function transport(
  agents: ReturnType<typeof fakeAgents>,
  options: {
    resume?: string
    startTimeoutMs?: number
    agentDef?: ACPAgentDef
    cwd?: string
    model?: string
    choices?: () => AgentChoices
  } = {}
) {
  const sessions: (string | null)[] = []
  /** What the session offered to choose each time it told the chat, and null once it ended. */
  const offered: (AgentModelChoices | null)[] = []
  /** The values the agent moved to on its own, each time it did. */
  const agentChose: AgentChoices[] = []
  const agentErrors: unknown[] = []
  const created = new ACPChatTransport({
    agentDef: options.agentDef ?? resuming,
    cwd: options.cwd,
    startup: agents.startup,
    resume: options.resume,
    model: options.model,
    choices: options.choices,
    onChoices: (reported) => offered.push(reported),
    onAgentChoices: (moved) => agentChose.push(moved),
    startTimeoutMs: options.startTimeoutMs ?? 1_000,
    onSession: (id) => sessions.push(id),
    onAgentError: (error) => agentErrors.push(error)
  })
  return { transport: created, sessions, agentErrors, offered, agentChose }
}
