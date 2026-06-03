import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { resolveCommand } from 'package-manager-detector/commands'
import { detect, getUserAgent } from 'package-manager-detector/detect'
import { WebSocketServer, type WebSocket } from 'ws'

import type { RpcJsonObject } from '#mcp/json'

import packageJson from '../package.json' with { type: 'json' }
import { bearerToken, isAuthorized, mcpRequestToken } from './auth'
import { createBrowserRpcBridge } from './browser-rpc'
import { MCP_CORS_HEADERS, MCP_CORS_METHODS, MCP_EXPOSED_HEADERS } from './http-options'
import { preprocessRpc } from './jsx-preprocess'
import { createMcpSessionManager } from './mcp-sessions'
import { registerTools } from './tool/registration'

export const MCP_VERSION: string = packageJson.version

const HEARTBEAT_INTERVAL_MS = 5_000

let installCommandPromise: Promise<string> | null = null

async function resolveMcpInstallCommand(): Promise<string> {
  const agent =
    getUserAgent() ??
    (
      await detect({
        strategies: ['install-metadata', 'lockfile', 'packageManager-field', 'devEngines-field']
      })
    )?.agent ??
    'npm'
  const resolved = resolveCommand(agent, 'global', [`@inkly/mcp@${MCP_VERSION}`])
  if (!resolved) return `npm install -g @inkly/mcp@${MCP_VERSION}`
  return [resolved.command, ...resolved.args].join(' ')
}

function mcpInstallCommand(): Promise<string> {
  installCommandPromise ??= resolveMcpInstallCommand()
  return installCommandPromise
}

export { fail, ok, type MCPContent, type MCPResult } from './result'

export { registerTools, type RegisterToolsOptions, type RpcSender } from './tool/registration'
export { paramToZod } from './tool/schema'

export interface ServerOptions {
  httpPort?: number
  wsPort?: number
  enableEval?: boolean
  mcpRoot?: string | null
  authToken?: string | null
  corsOrigin?: string | null
}

export function startServer(options: ServerOptions = {}) {
  const httpPort = options.httpPort ?? 7600
  const wsPort = options.wsPort ?? 7601
  const enableEval = options.enableEval ?? false
  const mcpRoot = options.mcpRoot ?? null
  const authToken = options.authToken ?? null
  const corsOrigin = options.corsOrigin ?? null

  const mcpSessions = createMcpSessionManager({
    serverVersion: MCP_VERSION,
    registerTools: (mcpServer: McpServer) =>
      registerTools(mcpServer, { enableEval, mcpRoot, sendRpc: sendToBrowser })
  })
  const browserRpc = createBrowserRpcBridge({
    authToken,
    onConnectionChange: mcpSessions.notifyToolsChanged
  })
  const sendToBrowser = browserRpc.sendRpc

  // --- WebSocket: browser connects here ---

  const wss = new WebSocketServer({ port: wsPort, host: '127.0.0.1' })
  const alive = new WeakMap<WebSocket, boolean>()

  wss.on('connection', (ws) => {
    alive.set(ws, true)
    browserRpc.handleConnection(ws)

    ws.on('pong', () => alive.set(ws, true))
    ws.on('message', (raw) => {
      alive.set(ws, true)
      const data = typeof raw === 'string' ? raw : Buffer.from(raw as Buffer).toString('utf-8')
      browserRpc.handleMessage(data, ws)
    })

    ws.on('close', () => {
      browserRpc.handleClose(ws)
    })

    ws.on('error', () => {
      try {
        ws.terminate()
      } catch {
        alive.delete(ws)
      }
    })
  })

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (alive.get(ws) === false) {
        try {
          ws.terminate()
        } catch {
          continue
        }
        continue
      }
      alive.set(ws, false)
      try {
        ws.ping()
      } catch {
        continue
      }
    }
  }, HEARTBEAT_INTERVAL_MS)
  heartbeat.unref()
  wss.on('close', () => clearInterval(heartbeat))

  // --- HTTP server ---

  const app = new Hono()

  if (corsOrigin) {
    app.use(
      '*',
      cors({
        origin: corsOrigin,
        allowMethods: MCP_CORS_METHODS,
        allowHeaders: MCP_CORS_HEADERS,
        exposeHeaders: MCP_EXPOSED_HEADERS
      })
    )
  }

  app.get('/health', async (c) =>
    c.json({
      status: browserRpc.isConnected() ? 'ok' : 'no_app',
      version: MCP_VERSION,
      installCommand: await mcpInstallCommand(),
      authRequired: authToken !== null,
      ...(browserRpc.currentRpcToken() ? { token: browserRpc.currentRpcToken() } : {})
    })
  )

  app.use('/rpc', async (c, next) => {
    const rpcToken = browserRpc.currentRpcToken()
    if (!browserRpc.isConnected() || !rpcToken) {
      return c.json({ error: 'Inkly app is not connected. Is a document open?' }, 503)
    }
    const provided = bearerToken(c.req.header('authorization'))
    if (!isAuthorized(provided, rpcToken)) {
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
      body = preprocessRpc(body as RpcJsonObject)
      const result = await sendToBrowser(body as RpcJsonObject)
      return c.json(result)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return c.json({ ok: false, error: msg }, 502)
    }
  })

  // --- MCP Streamable HTTP ---

  app.all('/mcp', async (c) => {
    if (authToken) {
      const token = mcpRequestToken(c.req.header('authorization'), c.req.header('x-mcp-token'))
      if (!isAuthorized(token, authToken)) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
    }
    const sessionId = c.req.header('mcp-session-id') ?? undefined
    const transport = mcpSessions.resolveTransport(sessionId)
    if ('error' in transport) {
      return c.json(
        { error: 'Too many active MCP sessions' },
        { status: 503, headers: { 'Retry-After': '5' } }
      )
    }
    mcpSessions.touch(sessionId, transport)
    const response = await transport.handleRequest(c.req.raw)
    if (c.req.method === 'DELETE') {
      mcpSessions.deleteSession(sessionId)
    }
    return response
  })

  function close() {
    browserRpc.close()
    mcpSessions.clear()
    wss.close()
  }

  return { app, wss, httpPort, close }
}
