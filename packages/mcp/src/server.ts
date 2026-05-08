import { createRequire } from 'node:module'

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { WebSocketServer } from 'ws'

import { bearerToken, isAuthorized, mcpRequestToken } from './auth'
import { createBrowserRpcBridge } from './browser-rpc'
import { MCP_CORS_HEADERS, MCP_CORS_METHODS, MCP_EXPOSED_HEADERS } from './http-options'
import { preprocessRpc } from './jsx-preprocess'
import { createMcpSessionManager } from './mcp-sessions'
import { registerTools } from './tool/registration'

const require = createRequire(import.meta.url)
export const MCP_VERSION: string = (require('../package.json') as { version: string }).version

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
  const unconnected = (_msg: unknown) => ({ error: true, message: 'Automation not connected' })
  let automation = unconnected
  const queue: Map<string, (response: unknown) => void> = new Map()

  wss.on('connection', (ws) => {
    let handler = (msg) => {
      if (msg.type === 'request') {
        console.log("Handling mcp client request", msg)
        queue.set(msg.id, (msg) => ws.send(msg))
        automation(msg)
      }
    }

    ws.on('message', (raw) => {
      const msg = JSON.parse(typeof raw === 'string' ? raw : Buffer.from(raw as Buffer).toString('utf-8'))

      if (msg.type === 'register') {
        console.log('Registering automation')
        automation = (req) => {
          console.log("Forwarding to automation", req)
          ws.send(JSON.stringify(req))
        }
        handler = (resp) => {
          console.log('Message from automation!', resp)
          if (resp.type === 'response') {
            queue.get(resp.id)?.(JSON.stringify(resp))
            queue.delete(resp.id)
          } else {
            console.log("Unknown message", resp)
          }
        }
      // TODO is it necessary?
      // } else if (msg.type === 'registerBrowser') {
      //   console.log('Registering browser')
      //   handler = (msg) => browserRpc.handleMessage(msg, ws)
      } else {
        handler(msg)
      }
    })

    ws.on('close', () => {
      browserRpc.handleClose(ws)
      // TODO automation = unconnected
    })

    ws.send(JSON.stringify({ type: 'register', token: authToken }))
  })

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

  app.get('/health', (c) =>
    c.json({
      status: browserRpc.isConnected() ? 'ok' : 'no_app',
      authRequired: authToken !== null,
      ...(browserRpc.currentRpcToken() ? { token: browserRpc.currentRpcToken() } : {})
    })
  )

  app.use('/rpc', async (c, next) => {
    const rpcToken = browserRpc.currentRpcToken()
    if (!browserRpc.isConnected() || !rpcToken) {
      return c.json({ error: 'OpenPencil app is not connected. Is a document open?' }, 503)
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
      body = preprocessRpc(body as Record<string, unknown>)
      const result = await sendToBrowser(body as Record<string, unknown>)
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
