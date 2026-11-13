import {
  methods,
  PROTOCOL_VERSION,
  type InitializeResponse,
  type SessionUpdate
} from '@agentclientprotocol/sdk/unstable'

import type { ACPAgentDef } from '@open-pencil/core/constants'

import { connectAgent, type AgentLaunch } from '@/app/ai/agents/acp/connection'
import type { OwnToolsLink, OwnToolsOutcome } from '@/app/ai/agents/acp/tools'
import { createDeferred, type Deferred } from '@/app/runtime/deferred'

import { isSignedIn, parseAuthMethods, type AgentAuthMethod, type AgentAuthStatus } from './status'

export interface AuthSessionOptions {
  launch?: AgentLaunch
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
  { launch, initializeTimeoutMs = INITIALIZE_TIMEOUT_MS }: AuthSessionOptions
) {
  const log = createStatusLog()
  let onUpdate: ((update: SessionUpdate) => void) | null = null
  // Nothing runs in this connection, so every permission request is refused.
  const connection = await connectAgent(agent, {
    logId: `${agent.id} sign-in`,
    timeoutMs: initializeTimeoutMs,
    launch,
    onSessionUpdate: ({ update }) => onUpdate?.(update),
    onAuthStatus: (status) => log.push(status)
  })
  let init: InitializeResponse
  try {
    init = await connection.bounded(
      connection.agent.request(methods.agent.initialize, {
        protocolVersion: PROTOCOL_VERSION,
        // Without it, Claude's adapter offers no sign-in methods.
        clientCapabilities: { _meta: { 'terminal-auth': true } }
      })
    )
  } catch (error) {
    await connection.close()
    throw error
  }
  return {
    connection,
    init,
    log,
    // A sign-in waits on the browser, so only the agent's exit ends these requests.
    untilStopped: <T>(request: Promise<T>) => connection.untilStopped(request),
    set onUpdate(listener: ((update: SessionUpdate) => void) | null) {
      onUpdate = listener
    },
    close: () => connection.close()
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
      session.connection.agent.request(methods.agent.session.new, {
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
    await session.untilStopped(
      session.connection.agent.request(methods.agent.authenticate, { methodId })
    )
    return await session.log.next(seen, statusTimeoutMs)
  } finally {
    signal.removeEventListener('abort', stop)
    await session.close()
  }
}
