import { randomUUID } from 'node:crypto'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'

export type MCPTransport = { handleRequest: (request: Request) => Promise<Response> }

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

export function createMcpSessionManager({ serverVersion, registerTools }: McpSessionManagerOptions) {
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
      }
    }
  }

  function createSession(id: string): MCPTransport {
    const server = new McpServer({ name: 'open-pencil', version: serverVersion })
    registerTools(server)

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => id,
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
    if (sessionId) sessions.delete(sessionId)
  }

  function clear() {
    sessions.clear()
  }

  return { clear, deleteSession, notifyToolsChanged, resolveTransport, touch }
}
