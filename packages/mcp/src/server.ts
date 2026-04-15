import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { WebSocketServer, type WebSocket } from 'ws'
import { z } from 'zod'

import {
  ALL_TOOLS,
  CODEGEN_PROMPT,
  buildComponent,
  createElement,
  resolveToTree
} from '@open-pencil/core'

import type { ParamDef, ParamType } from '@open-pencil/core'

const require = createRequire(import.meta.url)
export const MCP_VERSION: string = (require('../package.json') as { version: string }).version

export type MCPContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
export type MCPResult = { content: MCPContent[]; isError?: boolean }

const RPC_TIMEOUT = 30_000

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export function ok(data: unknown): MCPResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

export function fail(e: unknown): MCPResult {
  const msg = e instanceof Error ? e.message : String(e)
  return { content: [{ type: 'text', text: JSON.stringify({ error: msg }) }], isError: true }
}

export type RpcSender = (body: Record<string, unknown>) => Promise<unknown>

export interface RegisterToolsOptions {
  enableEval: boolean
  sendRpc: RpcSender
}

export function registerTools(mcpServer: McpServer, options: RegisterToolsOptions) {
  const { enableEval, sendRpc } = options
  const register = mcpServer.registerTool.bind(mcpServer) as (...a: unknown[]) => void

  for (const def of ALL_TOOLS) {
    if (!enableEval && def.name === 'eval') continue
    const shape: Record<string, z.ZodType> = {}
    for (const [key, param] of Object.entries(def.params)) {
      shape[key] = paramToZod(param)
    }
    register(
      def.name,
      { description: def.description, inputSchema: z.object(shape) },
      async (args: Record<string, unknown>) => {
        try {
          const result = await sendRpc({ command: 'tool', args: { name: def.name, args } })
          const res = result as { ok?: boolean; result?: unknown; error?: string }
          if (res.ok === false) return fail(new Error(res.error))
          const r = res.result as Record<string, unknown> | undefined
          if (r && 'base64' in r && 'mimeType' in r) {
            return {
              content: [
                {
                  type: 'image' as const,
                  data: r.base64 as string,
                  mimeType: r.mimeType as string
                }
              ]
            }
          }
          return ok(r)
        } catch (e) {
          return fail(e)
        }
      }
    )
  }

  register(
    'save_file',
    {
      description:
        'Save the current document to disk. Uses the existing file path if available, otherwise prompts for a location.',
      inputSchema: z.object({})
    },
    async () => {
      try {
        const result = await sendRpc({ command: 'save_file' })
        const res = result as { ok?: boolean; error?: string }
        if (res.ok === false) return fail(new Error(res.error))
        return ok({ saved: true })
      } catch (e) {
        return fail(e)
      }
    }
  )

  register(
    'get_codegen_prompt',
    {
      description:
        'Get design-to-code generation guidelines. Call before generating frontend code.',
      inputSchema: z.object({})
    },
    async () => ok({ prompt: CODEGEN_PROMPT })
  )
}

export function paramToZod(param: ParamDef): z.ZodType {
  const typeMap: Record<ParamType, () => z.ZodType> = {
    string: () =>
      param.enum
        ? z.enum(param.enum as [string, ...string[]]).describe(param.description)
        : z.string().describe(param.description),
    number: () => {
      let s = z.number()
      if (param.min !== undefined) s = s.min(param.min)
      if (param.max !== undefined) s = s.max(param.max)
      return s.describe(param.description)
    },
    boolean: () => z.boolean().describe(param.description),
    color: () => z.string().describe(param.description),
    'string[]': () => z.array(z.string()).min(1).describe(param.description)
  }

  const schema = typeMap[param.type]()
  return param.required ? schema : schema.optional()
}

export interface ServerOptions {
  httpPort?: number
  wsPort?: number
  enableEval?: boolean
  authToken?: string | null
  corsOrigin?: string | null
}

export function startServer(options: ServerOptions = {}) {
  const httpPort = options.httpPort ?? 7600
  const wsPort = options.wsPort ?? 7601
  const enableEval = options.enableEval ?? false
  const authToken = options.authToken ?? null
  const corsOrigin = options.corsOrigin ?? null

  const pending = new Map<string, PendingRequest>()
  let browserWs: WebSocket | null = null
  let browserToken: string | null = null
  let browserRegistered = false

  function currentRpcToken(): string | null {
    return authToken ?? browserToken
  }

  // --- WebSocket: browser connects here ---

  function sendToBrowser(body: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!browserWs || browserWs.readyState !== browserWs.OPEN || !browserRegistered) {
        reject(new Error('OpenPencil app is not connected'))
        return
      }
      const id = randomUUID()
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('RPC timeout (30s)'))
      }, RPC_TIMEOUT)
      pending.set(id, { resolve, reject, timer })
      browserWs.send(JSON.stringify({ type: 'request', id, ...body }))
    })
  }

  function handleBrowserMessage(data: string, ws: WebSocket) {
    try {
      const msg = JSON.parse(data) as {
        type: string
        id?: string
        token?: string
        result?: unknown
        error?: string
        ok?: boolean
      }
      if (msg.type === 'register' && msg.token) {
        if (authToken && msg.token !== authToken) {
          ws.close()
          return
        }
        if (browserWs && browserWs !== ws && browserWs.readyState === WebSocket.OPEN) {
          browserWs.close()
          rejectAllPending('Browser reconnected')
        }
        browserWs = ws
        browserToken = msg.token
        browserRegistered = true
        return
      }
      if (!browserRegistered || browserWs !== ws) return
      if (msg.type === 'response' && msg.id) {
        const req = pending.get(msg.id)
        if (!req) return
        pending.delete(msg.id)
        clearTimeout(req.timer)
        if (msg.ok === false) req.reject(new Error(msg.error ?? 'RPC failed'))
        else {
          const { type: _, id: __, ...payload } = msg
          req.resolve(payload)
        }
      }
    } catch (e) {
      console.warn('Malformed automation message:', e)
    }
  }

  function rejectAllPending(reason: string) {
    for (const [id, req] of pending) {
      clearTimeout(req.timer)
      req.reject(new Error(reason))
      pending.delete(id)
    }
  }

  const wss = new WebSocketServer({ port: wsPort, host: '127.0.0.1' })

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      handleBrowserMessage(
        typeof raw === 'string' ? raw : Buffer.from(raw as Buffer).toString('utf-8'),
        ws
      )
    })

    ws.on('close', () => {
      if (browserWs === ws) {
        browserWs = null
        browserToken = null
        browserRegistered = false
        rejectAllPending('Browser disconnected')
      }
    })
  })

  // --- JSX preprocessing ---

  function preprocessRpc(body: Record<string, unknown>): Record<string, unknown> {
    if (body.command !== 'tool') return body
    const args = body.args as { name?: string; args?: Record<string, unknown> } | undefined
    if (args?.name !== 'render' || !args.args?.jsx) return body
    try {
      const Component = buildComponent(args.args.jsx as string)
      const element = createElement(Component, null)
      const tree = resolveToTree(element)
      return {
        ...body,
        args: { ...args, args: { ...args.args, jsx: undefined, tree } }
      }
    } catch (e) {
      console.warn('JSX preprocessing failed, passing raw:', e instanceof Error ? e.message : e)
      return body
    }
  }

  // --- HTTP server ---

  const app = new Hono()

  if (corsOrigin) {
    app.use(
      '*',
      cors({
        origin: corsOrigin,
        allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'x-mcp-token',
          'mcp-session-id',
          'Last-Event-ID',
          'mcp-protocol-version'
        ],
        exposeHeaders: ['mcp-session-id', 'mcp-protocol-version']
      })
    )
  }

  app.get('/health', (c) =>
    c.json({
      status: browserWs && browserRegistered ? 'ok' : 'no_app',
      authRequired: authToken !== null,
      ...(currentRpcToken() ? { token: currentRpcToken() } : {})
    })
  )

  app.use('/rpc', async (c, next) => {
    const rpcToken = currentRpcToken()
    if (!browserWs || !browserRegistered || !rpcToken) {
      return c.json({ error: 'OpenPencil app is not connected. Is a document open?' }, 503)
    }
    const auth = c.req.header('authorization')
    const provided = auth?.startsWith('Bearer ') ? auth.slice(7) : null
    if (provided !== rpcToken) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    return next()
  })

  app.post('/rpc', async (c) => {
    let body = await c.req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return c.json({ error: 'Invalid request body' }, 400)
    }
    try {
      body = preprocessRpc(body as Record<string, unknown>)
      const result = await sendToBrowser(body as Record<string, unknown>)
      return c.json(result)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return c.json({ ok: false, error: msg }, 502)
    }
  })

  // --- MCP Streamable HTTP ---

  type MCPTransport = { handleRequest: (r: Request) => Promise<Response> }
  interface MCPSession {
    transport: MCPTransport
    lastSeen: number
  }
  const mcpSessions = new Map<string, MCPSession>()
  const MAX_MCP_SESSIONS = 10
  const MCP_SESSION_TTL_MS = 15 * 60_000

  function cleanupExpiredMCPSessions() {
    const now = Date.now()
    for (const [id, session] of mcpSessions) {
      if (now - session.lastSeen > MCP_SESSION_TTL_MS) {
        mcpSessions.delete(id)
      }
    }
  }

  function createMCPSession(id: string): MCPTransport {
    const mcpServer = new McpServer({ name: 'open-pencil', version: MCP_VERSION })
    registerTools(mcpServer, { enableEval, sendRpc: sendToBrowser })

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => id
    })
    void mcpServer.connect(transport)
    mcpSessions.set(id, { transport, lastSeen: Date.now() })
    return transport
  }

  app.all('/mcp', async (c) => {
    if (authToken) {
      const auth = c.req.header('authorization')
      const token = auth?.startsWith('Bearer ')
        ? auth.slice('Bearer '.length)
        : c.req.header('x-mcp-token')
      if (token !== authToken) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
    }
    cleanupExpiredMCPSessions()
    const sessionId = c.req.header('mcp-session-id') ?? undefined
    const existing = sessionId ? mcpSessions.get(sessionId) : undefined
    if (!existing && mcpSessions.size >= MAX_MCP_SESSIONS) {
      return c.json(
        { error: 'Too many active MCP sessions' },
        { status: 503, headers: { 'Retry-After': '5' } }
      )
    }
    const transport = existing?.transport ?? createMCPSession(sessionId ?? randomUUID())
    const resolvedSessionId =
      sessionId ??
      [...mcpSessions.entries()].find(([, entry]) => entry.transport === transport)?.[0]
    if (resolvedSessionId) {
      const session = mcpSessions.get(resolvedSessionId)
      if (session) session.lastSeen = Date.now()
    }
    const response = await transport.handleRequest(c.req.raw)
    if (c.req.method === 'DELETE' && sessionId) {
      mcpSessions.delete(sessionId)
    }
    return response
  })

  return { app, wss, httpPort }
}
