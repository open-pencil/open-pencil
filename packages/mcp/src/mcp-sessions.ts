import { randomUUID } from 'node:crypto'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'

export type MCPTransport = {
  handleRequest: (request: Request) => Promise<Response>
  close: () => Promise<void>
}

type MCPSession = {
  transport: MCPTransport
  server: McpServer
  lastSeen: number
}

type McpSessionManagerOptions = {
  serverVersion: string
  registerTools: (server: McpServer) => void
}

const MAX_MCP_SESSIONS = 10
const MCP_SESSION_TTL_MS = 15 * 60_000
const SESSION_CLOSE_TIMEOUT_MS = 5_000

function describeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * Wraps a promise with a timeout. Resolves with undefined if the timeout
 * elapses before the promise settles. Used to prevent `transport.close()`
 * from hanging indefinitely — the MCP SDK's close() does not enforce a
 * timeout internally.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer)
    }),
    new Promise<T | undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), ms)
    })
  ])
}

async function closeSession(session: MCPSession): Promise<void> {
  try {
    await withTimeout(session.transport.close(), SESSION_CLOSE_TIMEOUT_MS)
  } catch (e) {
    // Best-effort: the transport may already be closed or in a bad state
    process.stderr.write(`  MCP session: transport close warning (${describeError(e)})\n`)
  }
  try {
    await withTimeout(session.server.close(), SESSION_CLOSE_TIMEOUT_MS)
  } catch (e) {
    // Best-effort
    process.stderr.write(`  MCP session: server close warning (${describeError(e)})\n`)
  }
}

export function createMcpSessionManager({
  serverVersion,
  registerTools
}: McpSessionManagerOptions) {
  const sessions = new Map<string, MCPSession>()

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
    const now = Date.now()
    for (const [id, session] of sessions) {
      if (now - session.lastSeen > MCP_SESSION_TTL_MS) {
        sessions.delete(id)
        void closeSession(session)
      }
    }
  }

  const creating = new Map<string, Promise<MCPTransport>>()
  let closed = false

  async function createSession(id: string): Promise<MCPTransport> {
    if (closed) throw new Error('Session manager is closed')
    const inFlight = creating.get(id)
    if (inFlight) return inFlight

    const promise = (async () => {
      const server = new McpServer({ name: 'open-pencil', version: serverVersion })
      registerTools(server)

      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => id,
        enableJsonResponse: true
      })
      // Await the MCP handshake before storing/returning the transport so
      // handleRequest cannot race the SDK's initialization on a fresh
      // session. Without this, the /mcp route calls resolveTransport() and
      // immediately awaits handleRequest(), which can fail if connect() has
      // not completed yet.
      try {
        await server.connect(transport)
      } catch (e) {
        await transport.close().catch(() => undefined)
        await server.close().catch(() => undefined)
        throw e
      }
      // `closed` is mutated by clear() which can run concurrently — TypeScript's
      // control-flow analysis can't track this cross-closure mutation.
      // oxlint-disable-next-line no-unnecessary-condition
      if (closed) {
        // Manager was closed while we were connecting — clean up immediately.
        await transport.close().catch(() => undefined)
        await server.close().catch(() => undefined)
        throw new Error('Session manager closed during session creation')
      }
      sessions.set(id, { transport, server, lastSeen: Date.now() })
      return transport
    })()

    creating.set(id, promise)
    try {
      return await promise
    } finally {
      creating.delete(id)
    }
  }

  function resolveTransport(
    sessionId: string | undefined
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
    if (sessions.size + creating.size >= MAX_MCP_SESSIONS) {
      return Promise.resolve({ error: 'too_many' })
    }
    return createSession(sessionId ?? randomUUID()).catch((e) => {
      // If the manager was closed during session creation, return the structured
      // error instead of letting the throw escape as a route-level 500.
      if (closed) return { error: 'closed' as const }
      throw e
    })
  }

  function touch(sessionId: string | undefined, transport: MCPTransport) {
    const resolvedSessionId =
      sessionId ?? [...sessions.entries()].find(([, entry]) => entry.transport === transport)?.[0]
    if (!resolvedSessionId) return
    const session = sessions.get(resolvedSessionId)
    if (session) session.lastSeen = Date.now()
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
    if (!sessionId) return { error: 'not_found' }
    const existing = sessions.get(sessionId)
    if (existing) return existing.transport
    return { error: 'not_found' }
  }

  function deleteSession(sessionId: string | undefined) {
    if (!sessionId) return
    const session = sessions.get(sessionId)
    if (!session) return
    sessions.delete(sessionId)
    void closeSession(session)
  }

  async function clear() {
    closed = true
    // Wait for in-flight session creations to finish (they will check
    // `closed` and clean up without storing the session).
    const inFlight = [...creating.values()]
    await Promise.allSettled(inFlight)
    const all = [...sessions.values()]
    sessions.clear()
    creating.clear()
    await Promise.all(all.map(closeSession))
  }

  return { clear, deleteSession, getExistingTransport, notifyToolsChanged, resolveTransport, touch }
}
