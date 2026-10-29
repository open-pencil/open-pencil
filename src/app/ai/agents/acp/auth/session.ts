import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk'
import type { InitializeResponse, SessionUpdate } from '@agentclientprotocol/sdk'
import { promiseTimeout } from '@vueuse/core'

import type { ACPAgentDef } from '@open-pencil/core/constants'

import { spawnACPProcess } from '@/app/ai/agents/acp/process'
import type { OwnToolsLink, OwnToolsOutcome } from '@/app/ai/agents/acp/tools'
import { createDeferred, type Deferred } from '@/app/runtime/deferred'

import {
  isSignedIn,
  parseAuthMethods,
  parseAuthStatusUpdate,
  type AgentAuthMethod,
  type AgentAuthStatus
} from './status'

/** An agent process's stdio and the way to stop it. */
export interface AgentStreams {
  input: WritableStream<Uint8Array>
  output: ReadableStream<Uint8Array>
  close(): Promise<void>
}

export type SpawnAgent = (agent: ACPAgentDef) => Promise<AgentStreams>

export interface AuthSessionOptions {
  spawn?: SpawnAgent
  /** How long to wait for a login report; adapters read their CLI's with a 5 s limit. */
  statusTimeoutMs?: number
  /** How long an agent may take to answer `initialize` before it counts as stuck. */
  initializeTimeoutMs?: number
  /** Also checks, for a signed-in agent, that a session reaches OpenPencil's tools. */
  tools?: ToolsProbe
}

/** How a check starts a session the way a chat does, without sending a prompt. */
export interface ToolsProbe {
  /** The folder a chat's session starts in. */
  cwd: () => Promise<string>
  link: () => Promise<OwnToolsLink>
}

const STATUS_TIMEOUT_MS = 8_000
const INITIALIZE_TIMEOUT_MS = 30_000

/** What an agent says about its login when it starts, without a session or a prompt. */
export interface AgentAuthCheck {
  /** Null when the agent reported nothing in time, so its login is unknown. */
  status: AgentAuthStatus | null
  methods: AgentAuthMethod[]
  /** The ACP program that answered, to tell a supported adapter from another with its name. */
  adapter: { name: string; version: string } | null
  /** Whether a session reached OpenPencil's tools; null when not checked or not signed in. */
  tools: OwnToolsOutcome | null
}

export async function spawnAgentStreams(agent: ACPAgentDef): Promise<AgentStreams> {
  let closing = false
  const { child, input, output } = await spawnACPProcess({
    command: agent.command,
    args: agent.args,
    logId: `${agent.id} sign-in`,
    destroying: () => closing,
    onUnexpectedClose: () => undefined
  })
  return {
    input,
    output,
    async close() {
      closing = true
      await child.kill().catch(() => undefined)
    }
  }
}

/** Login reports in arrival order, so a caller can wait for one newer than it has seen. */
function createStatusLog() {
  const reports: AgentAuthStatus[] = []
  let waiting: { after: number; deferred: Deferred<AgentAuthStatus | null> } | null = null
  return {
    get count() {
      return reports.length
    },
    push(status: AgentAuthStatus) {
      reports.push(status)
      if (waiting && reports.length > waiting.after) waiting.deferred.resolve(status)
    },
    /** The first report after `after` reports, or the latest one if none comes in time. */
    async next(after: number, timeoutMs: number): Promise<AgentAuthStatus | null> {
      if (reports.length > after) return reports.at(-1) ?? null
      const deferred = createDeferred<AgentAuthStatus | null>()
      waiting = { after, deferred }
      const timer = setTimeout(() => deferred.resolve(reports.at(-1) ?? null), timeoutMs)
      try {
        return await deferred.promise
      } finally {
        clearTimeout(timer)
        waiting = null
      }
    }
  }
}

async function openAuthSession(
  agent: ACPAgentDef,
  { spawn = spawnAgentStreams, initializeTimeoutMs = INITIALIZE_TIMEOUT_MS }: AuthSessionOptions
) {
  const streams = await spawn(agent)
  const log = createStatusLog()
  let onUpdate: ((update: SessionUpdate) => void) | null = null
  const connection = new ClientSideConnection(
    () => ({
      // Nothing runs in this connection, so nothing may ask for permission.
      requestPermission: async () => ({ outcome: { outcome: 'cancelled' } }),
      sessionUpdate: async ({ update }) => onUpdate?.(update),
      extNotification: async (method, params) => {
        const status = parseAuthStatusUpdate(method, params)
        if (status) log.push(status)
      }
    }),
    ndJsonStream(streams.input, streams.output)
  )
  // The SDK leaves requests pending when the agent exits, so each one races the connection.
  const stopped = connection.closed.then(() => {
    throw new Error('The agent stopped.')
  })
  stopped.catch(() => undefined)
  function untilStopped<T>(request: Promise<T>): Promise<T> {
    return Promise.race([request, stopped])
  }
  let init: InitializeResponse
  try {
    init = await untilStopped(
      Promise.race([
        connection.initialize({
          protocolVersion: PROTOCOL_VERSION,
          // Without it, Claude's adapter offers no sign-in methods.
          clientCapabilities: { _meta: { 'terminal-auth': true } }
        }),
        promiseTimeout(initializeTimeoutMs).then((): never => {
          throw new Error('The agent did not start.')
        })
      ])
    )
  } catch (error) {
    await streams.close()
    throw error
  }
  return {
    connection,
    init,
    log,
    untilStopped,
    set onUpdate(listener: ((update: SessionUpdate) => void) | null) {
      onUpdate = listener
    },
    close: () => streams.close()
  }
}

function adapterOf(init: InitializeResponse): AgentAuthCheck['adapter'] {
  return init.agentInfo ? { name: init.agentInfo.name, version: init.agentInfo.version } : null
}

type AuthSession = Awaited<ReturnType<typeof openAuthSession>>

/** Starts a session as a chat would, sends nothing, and reports whether it reached the tools. */
async function checkTools(session: AuthSession, probe: ToolsProbe): Promise<OwnToolsOutcome> {
  let link: OwnToolsLink | null = null
  try {
    // Linking reads the MCP server's token, which fails while the server is down.
    link = await probe.link()
    const linked = link
    session.onUpdate = (update) => linked.noteUpdate(update)
    await session.untilStopped(
      session.connection.newSession({
        cwd: await probe.cwd(),
        mcpServers: link.mcpServers,
        _meta: link.meta
      })
    )
    return await session.untilStopped(link.outcome())
  } catch (error) {
    link?.stop()
    return { connected: false, reason: error instanceof Error ? error.message : String(error) }
  } finally {
    session.onUpdate = null
  }
}

/** Starts the agent, reads the login it reports, and stops it. */
export async function checkAgentAuth(
  agent: ACPAgentDef,
  options: AuthSessionOptions = {}
): Promise<AgentAuthCheck> {
  const { statusTimeoutMs = STATUS_TIMEOUT_MS } = options
  const session = await openAuthSession(agent, options)
  try {
    const status = await session.log.next(0, statusTimeoutMs)
    return {
      status,
      methods: parseAuthMethods(session.init.authMethods),
      adapter: adapterOf(session.init),
      tools:
        options.tools && status && isSignedIn(status)
          ? await checkTools(session, options.tools)
          : null
    }
  } finally {
    await session.close()
  }
}

/**
 * Signs in through an auth method the agent runs itself, such as Codex's ChatGPT login, which
 * opens the browser and waits for it. Aborting stops the agent and rejects.
 */
export async function signInWithAgent(
  agent: ACPAgentDef,
  methodId: string,
  signal: AbortSignal,
  options: AuthSessionOptions = {}
): Promise<AgentAuthStatus | null> {
  const { statusTimeoutMs = STATUS_TIMEOUT_MS } = options
  const session = await openAuthSession(agent, options)
  const stop = () => void session.close()
  signal.addEventListener('abort', stop, { once: true })
  try {
    // The login reported at startup must not pass for the one after signing in.
    await session.untilStopped(session.log.next(0, statusTimeoutMs))
    signal.throwIfAborted()
    const seen = session.log.count
    await session.untilStopped(session.connection.authenticate({ methodId }))
    return await session.log.next(seen, statusTimeoutMs)
  } finally {
    signal.removeEventListener('abort', stop)
    await session.close()
  }
}
