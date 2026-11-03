import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk'
import type {
  Client,
  Agent,
  SessionNotification,
  SessionUpdate,
  RequestPermissionRequest,
  RequestPermissionResponse,
  Usage
} from '@agentclientprotocol/sdk'
import { promiseTimeout } from '@vueuse/core'
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai'
import * as v from 'valibot'

import type { ACPAgentDef } from '@open-pencil/core/constants'

import { parseAuthStatusUpdate } from '@/app/ai/agents/acp/auth/status'
import { setAgentCommands } from '@/app/ai/agents/acp/commands'
import { createUpdateMapper } from '@/app/ai/agents/acp/events'
import { requestPermissionFromUser } from '@/app/ai/agents/acp/permission'
import { spawnACPProcess, type ACPProcess } from '@/app/ai/agents/acp/process'
import {
  AgentSessionResumeError,
  isAuthRequiredError,
  openAgentSession
} from '@/app/ai/agents/acp/session'
import { createOwnToolApproval, linkOwnTools, type OwnToolsLink } from '@/app/ai/agents/acp/tools'
import { agentAccounts } from '@/app/ai/agents/setup/accounts'
import { resolveSpawnCommand } from '@/app/ai/agents/setup/discovery'
import { AgentNotInstalledError } from '@/app/ai/agents/setup/readiness'
import { notifyPermissionWaiting } from '@/app/ai/chat/notifications'
import SYSTEM_PROMPT from '@/app/ai/chat/system-prompt'
import { endRun, forgetAgentChat, startAgentRun } from '@/app/ai/reply/run'
import { getAutomationAuthToken } from '@/app/automation/mcp/spawn'
import { describeDiagnosticError, recordACPTransportFailure } from '@/app/diagnostics'
import type { EditorStore } from '@/app/editor/active-store'

type TauriChild = ACPProcess['child']

/** What starting an agent reaches outside the transport, which tests replace. */
export interface ACPStartup {
  resolveCommand: typeof resolveSpawnCommand
  spawn: typeof spawnACPProcess
  authToken: typeof getAutomationAuthToken
  linkTools: typeof linkOwnTools
}

const DEFAULT_STARTUP: ACPStartup = {
  resolveCommand: resolveSpawnCommand,
  spawn: spawnACPProcess,
  authToken: getAutomationAuthToken,
  linkTools: linkOwnTools
}

/**
 * Updates that belong to a turn the agent took, after which it can continue the session even if
 * the turn is cut off. Claude Code and Codex cannot resume a session that never took a prompt, and
 * both send command, usage, and session info updates before they take one.
 */
const TURN_UPDATES: ReadonlySet<SessionUpdate['sessionUpdate']> = new Set([
  'user_message_chunk',
  'agent_message_chunk',
  'agent_thought_chunk',
  'tool_call',
  'tool_call_update',
  'plan'
])

/** How long each startup request may take; resuming starts the agent's CLI, which is slowest. */
const AGENT_START_TIMEOUT_MS = 60_000

interface ACPSession {
  connection: ClientSideConnection
  sessionId: string
  /** The id the agent's tool calls carry, which ties them to this chat's replies. */
  chat: string
  child: TauriChild
  onUpdate: ((params: SessionNotification) => void) | null
  dead: boolean
  /** The model the agent says it uses, once it has said; Codex names it, Claude in its usage. */
  model: string | null
  /** Whether the agent continued a saved session, which already holds the instructions. */
  resumed: boolean
}

/** One agent turn's tokens, as an ACP agent reports them with its answer to the prompt. */
export interface AgentTurnUsage {
  model: string | null
  /** All input tokens, cached ones included, as the AI SDK counts a provider model's input. */
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number | null
  cacheWriteTokens: number | null
}

/**
 * The agents report fresh input apart from cache reads and writes; the chat's other models count
 * all of it as input, with the cached part broken out.
 */
export function agentTurnUsage(usage: Usage, model: string | null): AgentTurnUsage {
  const cacheReadTokens = usage.cachedReadTokens ?? null
  const cacheWriteTokens = usage.cachedWriteTokens ?? null
  return {
    model,
    inputTokens: usage.inputTokens + (cacheReadTokens ?? 0) + (cacheWriteTokens ?? 0),
    outputTokens: usage.outputTokens,
    cacheReadTokens,
    cacheWriteTokens
  }
}

const usageMetaSchema = v.object({ '_claude/model': v.string() })

function isMissingCommandError(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('enoent') || normalized.includes('program not found')
}

function missingCommandMessage(agentDef?: ACPAgentDef): string {
  if (!agentDef) return 'ACP agent CLI is not installed.'
  if (!agentDef.installCommand) {
    return `"${agentDef.command}" is not installed. Install it and restart OpenPencil.`
  }
  return `"${agentDef.command}" is not installed. Install it with: ${agentDef.installCommand}`
}

export function formatConnectionError(e: unknown, agentDef?: ACPAgentDef): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (
    msg.includes('ECONNREFUSED') ||
    msg.includes('fetch failed') ||
    msg.includes('Failed to fetch')
  ) {
    return 'MCP server is not running. Make sure the editor is open.'
  }
  if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('ETIMEDOUT')) {
    return 'MCP server did not respond in time.'
  }
  if (isMissingCommandError(msg)) {
    return missingCommandMessage(agentDef)
  }
  if (isAuthRequiredError(e)) {
    return `${agentDef?.name ?? 'The agent'} is not signed in. Sign in from Set up AI, then try again.`
  }
  return msg
}

/** The agent never opened its session with OpenPencil's MCP server, so it has no design tools. */
function toolsUnreachableError(agentDef: ACPAgentDef, reason: string | null): Error {
  return new Error(
    `${agentDef.name} couldn't reach OpenPencil's tools, so your message wasn't sent.` +
      (reason ? ` ${agentDef.name} reported: ${reason}` : '')
  )
}

/** Closes a tools link that opens after the startup gave up, so it does not stay open. */
function stopWhenLinked(linking: Promise<OwnToolsLink>): void {
  linking.then((late) => late.stop()).catch(() => undefined)
}

function startupError(error: unknown, agentDef: ACPAgentDef): Error {
  recordACPTransportFailure({ operation: 'start', ...describeDiagnosticError(error) })
  return new Error(formatConnectionError(error, agentDef))
}

export function buildCrashChunks(
  destroying: boolean,
  textId: string,
  textStarted: boolean
): { chunks: UIMessageChunk[]; shouldNullSession: boolean } {
  if (destroying) return { chunks: [], shouldNullSession: false }
  const chunks: UIMessageChunk[] = []
  if (textStarted) chunks.push({ type: 'text-end', id: textId })
  chunks.push({ type: 'error', errorText: 'Agent process exited unexpectedly.' })
  chunks.push({ type: 'finish-step' })
  chunks.push({ type: 'finish', finishReason: 'error' })
  return { chunks, shouldNullSession: true }
}

export class ACPChatTransport implements ChatTransport<UIMessage> {
  private session: ACPSession | null = null
  private agentDef: ACPAgentDef
  private cwd: string
  private sentContext = false
  private destroying = false
  /** The agent while it starts, before it becomes the session, so destroying can stop it. */
  private starting: TauriChild | null = null

  /** The chat's document, where each reply's run records the edits the agent makes in it. */
  private store: EditorStore | null
  private onUsage: ((usage: AgentTurnUsage) => void) | null
  /** The agent session the next start continues: a saved chat's, then the one a turn ran in. */
  private resume: string | null
  private onSession: ((sessionId: string | null) => void) | null
  private startup: ACPStartup
  private startTimeoutMs: number

  constructor(options: {
    agentDef: ACPAgentDef
    cwd?: string
    store?: EditorStore
    /** Told each turn's tokens, which the Usage settings count with the chat's other models. */
    onUsage?: (usage: AgentTurnUsage) => void
    /** A saved chat's agent session, which the agent continues when it resumes sessions. */
    resume?: string | null
    /**
     * Told the agent's session once a prompt went to it, so the chat can be continued later,
     * and null when the saved session can no longer be continued.
     */
    onSession?: (sessionId: string | null) => void
    startup?: ACPStartup
    startTimeoutMs?: number
  }) {
    this.agentDef = options.agentDef
    this.cwd = options.cwd ?? '.'
    this.store = options.store ?? null
    this.onUsage = options.onUsage ?? null
    this.resume = options.resume ?? null
    this.onSession = options.onSession ?? null
    this.startup = options.startup ?? DEFAULT_STARTUP
    this.startTimeoutMs = options.startTimeoutMs ?? AGENT_START_TIMEOUT_MS
  }

  async sendMessages({
    messages,
    abortSignal
  }: Parameters<ChatTransport<UIMessage>['sendMessages']>[0]): Promise<
    ReadableStream<UIMessageChunk>
  > {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    const text =
      lastUserMessage?.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('\n') ?? ''

    if (this.session?.dead) {
      this.session = null
    }

    if (!this.session) {
      const started = await this.spawnAgent(abortSignal)
      // Destroyed between startup and here: the agent is still `starting`, so stop it.
      if (this.destroying) {
        await started.child.kill().catch(() => undefined)
        throw new Error('The chat closed while its agent was starting.')
      }
      this.session = started
      this.starting = null
      this.sentContext = started.resumed
    }

    const carriesContext = !this.sentContext
    const promptText = carriesContext ? `${SYSTEM_PROMPT}\n\n${text}` : text
    this.sentContext = true

    const { connection, sessionId } = this.session
    const session = this.session

    return new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        const mapper = createUpdateMapper(`turn-${Date.now()}`)
        let closed = false
        // The reply's run collects the edits the agent's calls make in the chat's document.
        const store = this.store
        const run = store ? startAgentRun(store, session.chat) : null

        function finish(reason: 'stop' | 'other' | 'error', errorText?: string) {
          if (closed) return
          closed = true
          if (store && run) endRun(store, run)
          if (errorText) controller.enqueue({ type: 'error', errorText })
          for (const chunk of mapper.end()) controller.enqueue(chunk)
          controller.enqueue({ type: 'finish-step' })
          controller.enqueue({ type: 'finish', finishReason: reason })
          session.onUpdate = null
          controller.close()
        }

        session.onUpdate = (params) => {
          if (closed) return
          if (TURN_UPDATES.has(params.update.sessionUpdate)) this.recordSession(sessionId)
          for (const chunk of mapper.map(params.update)) controller.enqueue(chunk)
        }

        abortSignal?.addEventListener('abort', () => {
          void connection.cancel({ sessionId })
          finish('stop')
        })

        controller.enqueue({ type: 'start' })
        controller.enqueue({ type: 'start-step' })

        // Stopped while the agent started and reached its tools: the abort event already fired.
        if (abortSignal?.aborted) {
          // The instructions went out with nothing, so the next message carries them.
          if (carriesContext) this.sentContext = false
          finish('stop')
          return
        }

        connection
          .prompt({
            sessionId,
            prompt: [{ type: 'text', text: promptText }]
          })
          // The prompt answers once the agent's turn is over; nothing else ends the reply.
          .then((result) => {
            this.recordSession(sessionId)
            if (result.usage) this.onUsage?.(agentTurnUsage(result.usage, session.model))
            finish(result.stopReason === 'end_turn' ? 'stop' : 'other')
            return undefined
          })
          .catch((e) => {
            recordACPTransportFailure({
              operation: 'message',
              ...describeDiagnosticError(e)
            })
            finish('error', formatConnectionError(e, this.agentDef))
          })
      }
    })
  }

  /** Keeps the session that took a prompt, which the agent continues when it starts again. */
  private recordSession(sessionId: string): void {
    if (!this.agentDef.resumesSessions || this.resume === sessionId) return
    this.resume = sessionId
    this.onSession?.(sessionId)
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null
  }

  async destroy(): Promise<void> {
    this.destroying = true
    const starting = this.starting
    this.starting = null
    await starting?.kill().catch(() => undefined)
    if (this.session) {
      forgetAgentChat(this.session.chat)
      await this.session.child.kill()
      this.session = null
    }
  }

  /**
   * Starts the agent and its session. Stop ends the startup at any step, and each step must answer
   * within the deadline; either way the agent stops and never gets the message.
   */
  private async spawnAgent(abortSignal?: AbortSignal): Promise<ACPSession> {
    const stoppedByUser = new Promise<never>((_, reject) => {
      const stop = () => reject(new Error('The reply was stopped while the agent was starting.'))
      if (abortSignal?.aborted) stop()
      else abortSignal?.addEventListener('abort', stop, { once: true })
    })
    stoppedByUser.catch(() => undefined)
    const startTimeoutMs = this.startTimeoutMs
    const agentName = this.agentDef.name
    const bounded = <T>(request: Promise<T>, ...also: Promise<never>[]): Promise<T> =>
      Promise.race([
        request,
        stoppedByUser,
        ...also,
        promiseTimeout(startTimeoutMs).then((): never => {
          throw new Error(`${agentName} did not answer while starting.`)
        })
      ])

    // Aborted once the startup gave up, by Stop or the deadline, so a lookup still running launches nothing.
    const gaveUp = new AbortController()
    const spawning = (async () => {
      const command = await this.startup.resolveCommand(this.agentDef)
      if (gaveUp.signal.aborted || abortSignal?.aborted) {
        throw new Error('The reply was stopped before the agent started.')
      }
      return this.startup.spawn({
        command,
        args: this.agentDef.args,
        logId: this.agentDef.id,
        destroying: () => this.destroying,
        onUnexpectedClose: () => {
          if (!this.session) return
          this.session.dead = true
          this.session = null
        }
      })
    })()
    let process: ACPProcess
    try {
      process = await bounded(spawning)
    } catch (e) {
      gaveUp.abort()
      // A process that starts after the startup gave up must not keep running.
      void spawning.then((late) => late.child.kill()).catch(() => undefined)
      recordACPTransportFailure({ operation: 'start', ...describeDiagnosticError(e) })
      if (e instanceof AgentNotInstalledError) throw e
      const message = e instanceof Error ? e.message : String(e)
      if (isMissingCommandError(message)) throw new AgentNotInstalledError(this.agentDef)
      throw new Error(formatConnectionError(e, this.agentDef))
    }
    const { child, input, output } = process
    const stream = ndJsonStream(input, output)
    let onUpdate: ACPSession['onUpdate'] = null
    // Set once the session exists; the client reads it to record the model the agent names.
    let sessionRef: ACPSession | null = null
    const agentId = this.agentDef.id
    const { agentDef, store } = this
    const ownToolApproval = createOwnToolApproval()

    const clientImpl: Client = {
      async requestPermission(
        params: RequestPermissionRequest
      ): Promise<RequestPermissionResponse> {
        const allowed = ownToolApproval.answer(params)
        if (allowed) return allowed
        const title = params.toolCall.title ?? ''
        return requestPermissionFromUser(
          params,
          store ? () => notifyPermissionWaiting(store, agentDef.name, title) : undefined
        )
      },

      async sessionUpdate(params: SessionNotification): Promise<void> {
        // Claude's adapter names its model only in its usage updates.
        const { update } = params
        ownToolApproval.noteUpdate(update)
        if (update.sessionUpdate === 'usage_update') {
          const meta = v.safeParse(usageMetaSchema, update._meta)
          if (meta.success && sessionRef) sessionRef.model = meta.output['_claude/model']
        }
        if (update.sessionUpdate === 'available_commands_update') {
          setAgentCommands(agentId, update.availableCommands)
        }
        onUpdate?.(params)
      },

      extNotification: async (method, params) => {
        const status = parseAuthStatusUpdate(method, params)
        if (!status) return
        agentAccounts.report(this.agentDef.id, status)
      }
    }

    const connection = new ClientSideConnection((_agent: Agent) => clientImpl, stream)
    this.starting = child
    // The SDK leaves requests pending when the agent exits, so each startup request races it.
    const stopped = connection.closed.then((): never => {
      throw new Error('The agent stopped while it was starting.')
    })
    stopped.catch(() => undefined)
    const untilStopped = <T>(request: Promise<T>): Promise<T> => bounded(request, stopped)
    // What startup opened so far, which a failed step closes along with the agent.
    let release: (() => void) | null = null
    const abandon = async (reason: Error): Promise<never> => {
      release?.()
      await child.kill().catch(() => undefined)
      throw reason
    }
    /** One startup step: when it fails or never answers, the agent stops and never gets a prompt. */
    const step = async <T>(request: Promise<T>, failed?: (error: unknown) => void): Promise<T> => {
      try {
        return await untilStopped(request)
      } catch (e) {
        failed?.(e)
        return abandon(startupError(e, this.agentDef))
      }
    }

    const automationAuthToken = await step(this.startup.authToken())
    const initialized = await step(
      connection.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
    )

    // The agent must reach OpenPencil's tools before it gets a prompt. An outside MCP connection
    // whose credential cannot be read fails here.
    const linking = this.startup.linkTools(automationAuthToken)
    release = () => stopWhenLinked(linking)
    const tools = await step(linking)
    release = () => tools.stop()
    onUpdate = ({ update }) => tools.noteUpdate(update)

    const opened = await step(
      openAgentSession(connection, this.agentDef, initialized, {
        cwd: this.cwd,
        mcpServers: tools.mcpServers,
        meta: tools.meta,
        resume: this.resume
      }),
      (e) => {
        // The saved conversation goes back to read-only; this chat keeps failing, never starting anew.
        if (e instanceof AgentSessionResumeError) this.onSession?.(null)
      }
    )

    const outcome = await step(tools.outcome())
    // Destroyed while starting, as when the chat closes: the agent must not get a prompt.
    if (this.destroying) await abandon(new Error('The chat closed while its agent was starting.'))
    if (outcome.connected === false) {
      const error = toolsUnreachableError(this.agentDef, outcome.reason)
      recordACPTransportFailure({ operation: 'start', ...describeDiagnosticError(error) })
      await abandon(error)
    }
    onUpdate = null

    const session: ACPSession = {
      connection,
      sessionId: opened.sessionId,
      chat: tools.chat,
      child,
      dead: false,
      model: opened.model,
      resumed: opened.resumed,
      get onUpdate() {
        return onUpdate
      },
      set onUpdate(fn) {
        onUpdate = fn
      }
    }

    sessionRef = session
    return session
  }
}
