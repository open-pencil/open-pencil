import { SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/sdk/types.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { resolveCommand } from 'package-manager-detector/commands'
import { detect, getUserAgent } from 'package-manager-detector/detect'
import { WebSocketServer } from 'ws'

import type { RpcJsonObject } from '#mcp/json'

import packageJson from '../package.json' with { type: 'json' }
import { bearerToken, isAuthorized, mcpRequestToken } from './auth'
import { createBrowserRpcBridge } from './browser-rpc'
import { MCP_CORS_HEADERS, MCP_CORS_METHODS, MCP_EXPOSED_HEADERS } from './http-options'
import { preprocessRpc } from './jsx-preprocess'
import { createMcpSessionManager } from './mcp-sessions'
import { registerTools } from './tool/registration'

export const MCP_VERSION: string = packageJson.version

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
  const resolved = resolveCommand(agent, 'global', [`@open-pencil/mcp@${MCP_VERSION}`])
  if (!resolved) return `npm install -g @open-pencil/mcp@${MCP_VERSION}`
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

  wss.on('connection', (ws) => {
    browserRpc.handleConnection(ws)

    ws.on('message', (raw) => {
      const data = typeof raw === 'string' ? raw : Buffer.from(raw as Buffer).toString('utf-8')
      browserRpc.handleMessage(data, ws)
    })

    ws.on('close', () => {
      browserRpc.handleClose(ws)
      mcpSessions.clear()
    })
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

  app.get('/health', async (c) => {
    const healthToken = authToken === null ? browserRpc.currentRpcToken() : null
    return c.json({
      status: browserRpc.isConnected() ? 'ok' : 'no_app',
      version: MCP_VERSION,
      installCommand: await mcpInstallCommand(),
      authRequired: authToken !== null,
      ...(healthToken ? { token: healthToken } : {})
    })
  })

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
      body = preprocessRpc(body as RpcJsonObject)
      const result = await sendToBrowser(body as RpcJsonObject)
      return c.json(result)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return c.json({ ok: false, error: msg }, 502)
    }
  })

  // --- OAuth auto-discovery for MCP clients (OpenCode, etc.) ---

  const serverBase = `http://127.0.0.1:${httpPort}`

  app.get('/.well-known/oauth-authorization-server', async (c) =>
    c.json({
      issuer: serverBase,
      authorization_endpoint: `${serverBase}/oauth/authorize`,
      token_endpoint: `${serverBase}/oauth/token`,
      token_endpoint_auth_methods_supported: ['none'],
      response_types_supported: ['token'],
      grant_types_supported: ['client_credentials']
    })
  )

  app.post('/oauth/token', async (c) => {
    if (!authToken) {
      return c.json({ error: 'No auth configured on this server' }, 400)
    }
    return c.json({ access_token: authToken, token_type: 'bearer' })
  })

  // --- MCP Streamable HTTP ---

  app.all('/mcp', async (c) => {
    if (authToken) {
      const token = mcpRequestToken(c.req.header('authorization'), c.req.header('x-mcp-token'))
      if (!isAuthorized(token, authToken)) {
        return c.json({ error: 'Unauthorized' }, 401, {
          'WWW-Authenticate': `Bearer realm="${serverBase}"`
        })
      }
    }
    const protocolVersion = c.req.header('mcp-protocol-version')
    if (protocolVersion && !SUPPORTED_PROTOCOL_VERSIONS.includes(protocolVersion)) {
      return c.json(
        {
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: `Unsupported protocol version "${protocolVersion}". Supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(', ')}`
          },
          id: null
        },
        400
      )
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
