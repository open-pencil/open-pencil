import { randomUUID } from 'node:crypto'

import {
  isJSONRPCResultResponse,
  McpServer,
  WebStandardStreamableHTTPServerTransport
} from '@modelcontextprotocol/server'
import { withTimeout } from 'es-toolkit/promise'

import { createPendingRequests } from '#mcp/server/pending-requests'
import { MCP_AGENT_KINDS, type MCPAgentSession, type MCPToolSettled } from '#mcp/tool/registration'

export type MCPTransport = {
  handleRequest: (request: Request) => Promise<Response>
  close: () => Promise<void>
}

type MCPSession = {
  transport: MCPTransport
  server: McpServer
  requests: ReturnType<typeof createPendingRequests>
  lastSeen: number
  activeRequests: number
  initialized: boolean
  agent: MCPAgentSession
}

/** Who opens a session, as its first request's headers say. */
export type MCPSessionOpener = Omit<MCPAgentSession, 'id'>

type MCPSessionManagerOptions = {
  serverVersion: string
  registerTools: (
    server: McpServer,
    session: MCPAgentSession,
    onToolSettled: MCPToolSettled
  ) => void
  /** Told when a client's initialize succeeds, so an app chat knows its agent reached the tools. */
  onSessionOpened?: (session: MCPAgentSession) => void
  /** Told when a session ends, so the app stops showing its agent. */
  onSessionClosed?: (sessionId: string) => void
  /** Idle lifetime in ms; 0 disables expiration. Defaults to 15 minutes. */
  sessionIdleTimeoutMs?: number
}

const MAX_MCP_SESSIONS = 10
/** App chat ids are random hex; anything else is ignored rather than forwarded. */
const CHAT_ID = /^[0-9a-f]{16,64}$/

/** The opener a session's first request names through the app's agent and chat headers. */
export function sessionOpener(
  kind: string | undefined,
  chat: string | undefined
): MCPSessionOpener {
  return {
    kind: MCP_AGENT_KINDS.find((candidate) => candidate === kind) ?? 'mcp',
    ...(chat && CHAT_ID.test(chat) ? { chat } : {})
  }
}
const MCP_SESSION_IDLE_TIMEOUT_MS = 15 * 60_000
const MAX_SWEEP_INTERVAL_MS = 60_000
// The MCP SDK's close() does not enforce a timeout internally.
const SESSION_CLOSE_TIMEOUT_MS = 5_000

function describeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

async function closeSession(session: Pick<MCPSession, 'transport' | 'server'>): Promise<void> {
  try {
    await withTimeout(() => session.transport.close(), SESSION_CLOSE_TIMEOUT_MS)
  } catch (e) {
    // Best-effort: the transport may already be closed or in a bad state
    process.stderr.write(`  MCP session: transport close warning (${describeError(e)})\n`)
  }
  try {
    await withTimeout(() => session.server.close(), SESSION_CLOSE_TIMEOUT_MS)
  } catch (e) {
    // Best-effort
    process.stderr.write(`  MCP session: server close warning (${describeError(e)})\n`)
  }
}

/**
 * The SDK assigns the session ID before it validates the InitializeRequest,
 * so a 200 carrying the session header can still be a JSON-RPC error.
 */
async function isInitializeResult(response: Response, id: string): Promise<boolean> {
  if (!response.ok || response.headers.get('mcp-session-id') !== id) return false
  const message: unknown = await response
    .clone()
    .json()
    .catch(() => undefined)
  return isJSONRPCResultResponse(message)
}

export function createMCPSessionManager({
  serverVersion,
  registerTools,
  onSessionOpened,
  onSessionClosed,
  sessionIdleTimeoutMs = MCP_SESSION_IDLE_TIMEOUT_MS
}: MCPSessionManagerOptions) {
  const sessions = new Map<string, MCPSession>()
  const closing = new Map<string, Promise<void>>()

  function scheduleClose(session: MCPSession, id: string): Promise<void> {
    try {
      if (session.initialized) onSessionClosed?.(id)
    } catch (e) {
      // Application notification must not prevent resource cleanup.
      process.stderr.write(`  MCP session: close notification warning (${describeError(e)})\n`)
    }
    const task = closeSession(session).finally(() => closing.delete(id))
    closing.set(id, task)
    return task
  }

  function notifyOpened(agent: MCPAgentSession) {
    try {
      onSessionOpened?.(agent)
    } catch (e) {
      // Application notification must not fail the client's initialize.
      process.stderr.write(`  MCP session: open notification warning (${describeError(e)})\n`)
    }
  }

  function notifyToolsChanged() {
    for (const session of sessions.values()) {
      try {
        session.server.sendToolListChanged()
      } catch {
        continue
      }
    }
  }

  function cleanupExpired() {
    if (sessionIdleTimeoutMs === 0) return
    const now = Date.now()
    for (const [id, session] of sessions) {
      if (session.activeRequests === 0 && now - session.lastSeen >= sessionIdleTimeoutMs) {
        sessions.delete(id)
        void scheduleClose(session, id)
      }
    }
  }

  const sweep =
    sessionIdleTimeoutMs > 0
      ? setInterval(cleanupExpired, Math.min(sessionIdleTimeoutMs, MAX_SWEEP_INTERVAL_MS)).unref()
      : undefined

  const creating = new Map<string, Promise<MCPTransport>>()
  let closed = false

  async function createSession(id: string, opener: MCPSessionOpener): Promise<MCPTransport> {
    if (closed) throw new Error('Session manager is closed')
    const inFlight = creating.get(id)
    if (inFlight) return inFlight

    const promise = (async () => {
      const server = new McpServer({ name: 'open-pencil', version: serverVersion })
      const agent: MCPAgentSession = { id, ...opener }

      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => id,
        enableJsonResponse: true
      })
      const requests = createPendingRequests(transport)
      // Connect the SDK before exposing its transport. The client's HTTP
      // InitializeRequest is processed later by handleRequest; connect() alone
      // does not establish a valid MCP session.
      try {
        registerTools(server, agent, requests.releaseCancelled)
        await server.connect(transport)
      } catch (e) {
        await closeSession({ transport, server })
        throw e
      }
      // `closed` is mutated by clear() which can run concurrently — TypeScript's
      // control-flow analysis can't track this cross-closure mutation.
      // oxlint-disable-next-line no-unnecessary-condition
      if (closed) {
        // Manager was closed while we were connecting — clean up immediately.
        await closeSession({ transport, server })
        throw new Error('Session manager closed during session creation')
      }
      const session: MCPSession = {
        server,
        requests,
        lastSeen: Date.now(),
        activeRequests: 0,
        initialized: false,
        agent,
        transport: {
          close: () => transport.close(),
          handleRequest: (request) => handleSessionRequest(id, session, request)
        }
      }
      // Closing a GET/SSE stream does not close the transport, so only a full
      // close ends the session. Keep the SDK's own protocol cleanup.
      const onclose = transport.onclose
      transport.onclose = () => {
        requests.close()
        try {
          onclose?.()
        } finally {
          void deleteSession(id)
        }
      }
      sessions.set(id, session)
      creating.delete(id)
      return session.transport
    })()

    creating.set(id, promise)
    try {
      return await promise
    } finally {
      creating.delete(id)
    }
  }

  async function handleSessionRequest(
    id: string,
    session: MCPSession,
    request: Request
  ): Promise<Response> {
    session.activeRequests++
    session.lastSeen = Date.now()
    try {
      const response = await session.requests.handle(request)
      if (!session.initialized) {
        session.initialized = await isInitializeResult(response, id)
        if (!session.initialized) await deleteSession(id)
        else notifyOpened(session.agent)
      }
      return response
    } catch (error) {
      if (!session.initialized) await deleteSession(id)
      throw error
    } finally {
      session.activeRequests--
      session.lastSeen = Date.now()
    }
  }

  function resolveTransport(
    sessionId: string | undefined,
    opener: MCPSessionOpener = { kind: 'mcp' }
  ): Promise<MCPTransport | { error: 'too_many' | 'closed' }> {
    if (closed) return Promise.resolve({ error: 'closed' })
    cleanupExpired()
    const existing = sessionId ? sessions.get(sessionId) : undefined
    if (existing) return Promise.resolve(existing.transport)
    // Reuse an in-flight creation for the same sessionId before enforcing the cap.
    if (sessionId) {
      const inFlight = creating.get(sessionId)
      if (inFlight) {
        // Wrap with the same catch as createSession so clear() during
        // in-flight creation returns { error: 'closed' } instead of throwing.
        return inFlight.catch((e) => {
          if (closed) return { error: 'closed' as const }
          throw e
        })
      }
    }
    if (sessions.size + creating.size + closing.size >= MAX_MCP_SESSIONS) {
      return Promise.resolve({ error: 'too_many' })
    }
    return createSession(sessionId ?? randomUUID(), opener).catch((e) => {
      // If the manager was closed during session creation, return the structured
      // error instead of letting the throw escape as a route-level 500.
      if (closed) return { error: 'closed' as const }
      throw e
    })
  }

  /**
   * Look up an existing session's transport without creating a new session.
   * Used for DELETE requests where creating a session just to delete it
   * would waste a session slot.
   */
  function getExistingTransport(
    sessionId: string | undefined
  ): MCPTransport | { error: 'not_found' | 'closed' } {
    if (closed) return { error: 'closed' }
    cleanupExpired()
    if (!sessionId) return { error: 'not_found' }
    const existing = sessions.get(sessionId)
    if (existing) return existing.transport
    return { error: 'not_found' }
  }

  async function deleteSession(sessionId: string | undefined): Promise<void> {
    if (closed) return
    if (!sessionId) return
    const session = sessions.get(sessionId)
    if (!session) return closing.get(sessionId)
    sessions.delete(sessionId)
    await scheduleClose(session, sessionId)
  }

  async function clear() {
    closed = true
    clearInterval(sweep)
    // Collect sessions before awaiting in-flight creations so new sessions
    // can't be added during shutdown.
    const all = [...sessions]
    sessions.clear()
    // Wait for in-flight session creations to finish (they will check
    // `closed` and clean up without storing the session).
    const inFlight = [...creating.values()]
    await Promise.allSettled(inFlight)
    creating.clear()
    // Await both previously-scheduled closes (from cleanupExpired/deleteSession)
    // and closes for sessions still alive at clear() time.
    await Promise.allSettled([
      ...closing.values(),
      ...all.map(([id, session]) => scheduleClose(session, id))
    ])
  }

  return { clear, deleteSession, getExistingTransport, notifyToolsChanged, resolveTransport }
}
