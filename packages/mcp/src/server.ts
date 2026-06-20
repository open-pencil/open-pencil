import { randomBytes } from 'node:crypto'
import type { Server as HttpServer } from 'node:http'

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { resolveCommand } from 'package-manager-detector/commands'
import { detect, getUserAgent } from 'package-manager-detector/detect'
import { WebSocketServer, type WebSocket } from 'ws'

import { bearerToken, isAuthorized, mcpRequestToken } from '#mcp/auth'
import { createBrowserRpcBridge } from '#mcp/browser-rpc'
import { MCP_CORS_HEADERS, MCP_CORS_METHODS, MCP_EXPOSED_HEADERS } from '#mcp/http-options'
import type { RpcJsonObject } from '#mcp/json'
import { preprocessRpc } from '#mcp/jsx-preprocess'
import { createMcpSessionManager } from '#mcp/mcp-sessions'
import { registerTools } from '#mcp/tool/registration'
import { getDiscoveryPath } from '#mcp/transport/paths'

import packageJson from '../package.json' with { type: 'json' }
import {
  type ListenerState,
  cleanupDiscovery,
  createAppServer,
  startSocketListener,
  teardownListeners,
  tryStartTcp,
  tryWriteDiscovery
} from './lifecycle'

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
  const resolved = resolveCommand(agent, 'global', [`@open-pencil/mcp@${MCP_VERSION}`])
  if (!resolved) return `npm install -g @open-pencil/mcp@${MCP_VERSION}`
  return [resolved.command, ...resolved.args].join(' ')
}

function mcpInstallCommand(): Promise<string> {
  installCommandPromise ??= resolveMcpInstallCommand()
  return installCommandPromise
}

export { fail, ok, type MCPContent, type MCPResult } from '#mcp/result'

export { registerTools, type RegisterToolsOptions, type RpcSender } from '#mcp/tool/registration'
export { paramToZod } from '#mcp/tool/schema'

export interface ServerOptions {
  /** TCP port for the HTTP + WebSocket server. Ignored when `withTcp` is false. When set to 0 with `withTcp: true`, binds to an ephemeral port. Defaults to 7600. */
  httpPort?: number
  /** Path to the Unix domain socket. Auto-resolved if omitted. */
  socketPath?: string | null
  /** Whether to also listen on TCP (in addition to the socket). API default is `false`; the CLI passes `true` by default (derived from PORT, default 7600). */
  withTcp?: boolean
  enableEval?: boolean
  mcpRoot?: string | null
  /** Auth token for /mcp and /rpc endpoints. Auto-generated (32-hex) when omitted. Pass null explicitly to disable auth. */
  authToken?: string | null
  corsOrigin?: string | null
}

export interface ServerHandle {
  /** The Hono app (routes) */
  app: Hono
  /** The primary Node.js HTTP server (socket listener if present, otherwise TCP) */
  server: HttpServer
  /** Resolved socket path (null if not listening on socket) */
  socketPath: string | null
  /** TCP port the server is listening on (0 if TCP is disabled) */
  httpPort: number
  /** Shut down the server: close listeners, remove socket and discovery files */
  close: () => Promise<void>
}

/** Set up Hono routes: /health, /rpc, /mcp */
function createHonoApp(options: {
  authToken: string | null
  corsOrigin: string | null
  browserRpc: ReturnType<typeof createBrowserRpcBridge>
  mcpSessions: ReturnType<typeof createMcpSessionManager>
  sendToBrowser: (msg: RpcJsonObject) => Promise<RpcJsonObject>
}): Hono {
  const { authToken, corsOrigin, browserRpc, mcpSessions, sendToBrowser } = options

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
      discoveryPath: await getDiscoveryPath()
    })
  )

  app.use('/rpc', async (c, next) => {
    // When authToken is null (operator explicitly disabled auth), skip token check —
    // the Unix socket or localhost TCP already restricts access to local processes.
    if (authToken !== null) {
      const provided = bearerToken(c.req.header('authorization'))
      if (!isAuthorized(provided, authToken)) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
    }
    return next()
  })

  // Historical note: before the isConnected() guard was removed, a disconnected
  // app returned 503 here. Now errors from sendToBrowser surface as 502. This
  // is a semantic shift from 503 → 502; callers that distinguished 503 may
  // need to handle 502 equivalently.
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

  app.all('/mcp', async (c) => {
    if (authToken !== null) {
      const token = mcpRequestToken(c.req.header('authorization'), c.req.header('x-mcp-token'))
      if (!isAuthorized(token, authToken)) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
    }
    const sessionId = c.req.header('mcp-session-id') ?? undefined
    // Reject anonymous DELETE requests before they allocate a session.
    // Without this guard, a DELETE without a session ID would call
    // resolveTransport(undefined), which creates a fresh session just
    // to no-op on deleteSession(undefined) — burning a session slot.
    if (c.req.method === 'DELETE' && !sessionId) {
      return c.json({ error: 'Missing MCP session id' }, 400)
    }
    const transport = await mcpSessions.resolveTransport(sessionId)
    if ('error' in transport) {
      if (transport.error === 'closed') {
        return c.json({ error: 'MCP server is shutting down' }, 503)
      }
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

  return app
}

/** Set up shared WebSocket connection handling and heartbeat. Call once. */
function wireConnectionHandling(
  wss: WebSocketServer,
  browserRpc: ReturnType<typeof createBrowserRpcBridge>
) {
  const alive = new WeakMap<WebSocket, boolean>()

  wss.on('connection', (ws: WebSocket) => {
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
}

function buildServerContext(options: ServerOptions) {
  const httpPort = options.httpPort ?? 7600
  const enableEval = options.enableEval ?? false
  const mcpRoot = options.mcpRoot ?? null
  // Auto-generated so all transports require auth by default. Override via OPENPENCIL_MCP_AUTH_TOKEN or authToken option.
  // Pass authToken: null explicitly to disable auth entirely.
  const authToken =
    options.authToken === undefined ? randomBytes(16).toString('hex') : options.authToken
  const corsOrigin = options.corsOrigin ?? null
  const withTcp = options.withTcp ?? false

  // Warn if auth is disabled while TCP is active — any local process can
  // interact with the server without authentication. Socket-only transport
  // (PORT=0) is safer because 0o600 permissions restrict access to the
  // same OS user.
  if (authToken === null && withTcp) {
    process.stderr.write(
      `WARNING: MCP server is running without authentication on TCP port ${httpPort}. ` +
        'Any local process can interact with the server. ' +
        'Set OPENPENCIL_MCP_AUTH_TOKEN to enable auth, or use PORT=0 for socket-only transport.\n'
    )
  }

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

  const app = createHonoApp({ authToken, corsOrigin, browserRpc, mcpSessions, sendToBrowser })
  const wss = new WebSocketServer({ noServer: true })

  return { httpPort, withTcp, mcpSessions, browserRpc, sendToBrowser, app, wss, authToken }
}

function buildHandle(
  app: Hono,
  wss: WebSocketServer,
  browserRpc: ReturnType<typeof createBrowserRpcBridge>,
  mcpSessions: ReturnType<typeof createMcpSessionManager>,
  state: ListenerState,
  resolvedSocketPath: string | null,
  actualHttpPort: number,
  authToken: string | null
): ServerHandle {
  // Promise-based lock ensures idempotency even under concurrent calls:
  // the first call creates the teardown promise; subsequent calls return
  // the same promise. JavaScript's event loop guarantees no preemption
  // between the guard check and the assignment.
  let closePromise: Promise<void> | null = null

  async function close() {
    if (closePromise) return closePromise
    closePromise = (async () => {
      browserRpc.close()
      await mcpSessions.clear()

      // Close the WebSocket server. wss.close() prevents new connections
      // but waits for existing ones to close naturally. If a client is
      // unresponsive, this can hang shutdown. Terminate lingering clients
      // after a short grace period to ensure shutdown completes promptly.
      await new Promise<void>((resolve) => {
        let settled = false
        const done = () => {
          if (settled) return
          settled = true
          resolve()
        }
        const graceTimer = setTimeout(() => {
          // Snapshot clients before iterating — terminate() triggers handleClose
          // which modifies wss.clients mid-iteration via clients.delete(ws).
          const snapshot = [...wss.clients]
          for (const ws of snapshot) {
            try {
              ws.terminate()
            } catch (e) {
              console.warn('[MCP] Failed to terminate WebSocket client:', e)
            }
          }
        }, 2_000).unref()
        wss.close(() => {
          clearTimeout(graceTimer)
          done()
        })
      })

      await teardownListeners(state)
      await cleanupDiscovery(authToken, resolvedSocketPath, actualHttpPort)
    })()
    return closePromise
  }

  const primary = state.socketResult?.server ?? state.tcpResult?.server ?? createAppServer(app)
  return {
    app,
    server: primary,
    socketPath: resolvedSocketPath,
    httpPort: actualHttpPort,
    close
  }
}

export async function startServer(options: ServerOptions = {}): Promise<ServerHandle> {
  const ctx = buildServerContext(options)

  // Wire shared connection handling BEFORE starting listeners so that
  // any client connecting during startup is handled immediately.
  wireConnectionHandling(ctx.wss, ctx.browserRpc)

  const state: ListenerState = { socketResult: null, tcpResult: null }
  try {
    state.socketResult = await startSocketListener(ctx.app, ctx.wss, options.socketPath ?? null)
    state.tcpResult = ctx.withTcp ? await tryStartTcp(ctx.app, ctx.wss, ctx.httpPort, state) : null
    const resolvedSocketPath = state.socketResult?.resolvedPath ?? null
    const actualHttpPort = state.tcpResult?.port ?? 0

    if (!resolvedSocketPath && !actualHttpPort) {
      throw new Error(
        'MCP server has no active listeners (both socket and TCP are unavailable). ' +
          'Ensure Unix domain sockets are supported on this platform or enable TCP with withTcp: true.'
      )
    }

    await tryWriteDiscovery(resolvedSocketPath, actualHttpPort, ctx.authToken, MCP_VERSION, state)
  } catch (err) {
    // Tear down any listeners that started before the failure, then close
    // all resources so nothing leaks when startServer rejects.
    await teardownListeners(state).catch(() => undefined)
    ctx.browserRpc.close()
    await new Promise<void>((resolve) => {
      ctx.wss.close(() => resolve())
    })
    await ctx.mcpSessions.clear().catch(() => undefined)
    throw err
  }

  const resolvedSocketPath = state.socketResult?.resolvedPath ?? null
  const actualHttpPort = state.tcpResult?.port ?? 0

  return buildHandle(
    ctx.app,
    ctx.wss,
    ctx.browserRpc,
    ctx.mcpSessions,
    state,
    resolvedSocketPath,
    actualHttpPort,
    ctx.authToken
  )
}
