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

function describeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

async function closeSession(session: MCPSession): Promise<void> {
  try {
    await session.transport.close()
  } catch (e) {
    // Best-effort: the transport may already be closed or in a bad state
    process.stderr.write(`  MCP session: transport close warning (${describeError(e)})\n`)
  }
  try {
    await session.server.close()
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

  async function createSession(id: string): Promise<MCPTransport> {
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
      await server.connect(transport)
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
  ): Promise<MCPTransport | { error: 'too_many' }> {
    cleanupExpired()
    const existing = sessionId ? sessions.get(sessionId) : undefined
    if (!existing && sessions.size + creating.size >= MAX_MCP_SESSIONS) {
      return Promise.resolve({ error: 'too_many' })
    }
    return existing ? Promise.resolve(existing.transport) : createSession(sessionId ?? randomUUID())
  }

  function touch(sessionId: string | undefined, transport: MCPTransport) {
    const resolvedSessionId =
      sessionId ?? [...sessions.entries()].find(([, entry]) => entry.transport === transport)?.[0]
    if (!resolvedSessionId) return
    const session = sessions.get(resolvedSessionId)
    if (session) session.lastSeen = Date.now()
  }

  function deleteSession(sessionId: string | undefined) {
    if (!sessionId) return
    const session = sessions.get(sessionId)
    if (!session) return
    sessions.delete(sessionId)
    void closeSession(session)
  }

  async function clear() {
    const all = [...sessions.values()]
    sessions.clear()
    await Promise.all(all.map(closeSession))
  }

  return { clear, deleteSession, notifyToolsChanged, resolveTransport, touch }
}
