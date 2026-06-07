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

  function createSession(id: string): MCPTransport {
    const server = new McpServer({ name: 'open-pencil', version: serverVersion })
    registerTools(server)

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => id,
      enableJsonResponse: true
    })
    void server.connect(transport)
    sessions.set(id, { transport, server, lastSeen: Date.now() })
    return transport
  }

  function resolveTransport(sessionId: string | undefined): MCPTransport | { error: 'too_many' } {
    cleanupExpired()
    const existing = sessionId ? sessions.get(sessionId) : undefined
    if (!existing && sessions.size >= MAX_MCP_SESSIONS) {
      return { error: 'too_many' }
    }
    return existing?.transport ?? createSession(sessionId ?? randomUUID())
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
