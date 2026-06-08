import { randomBytes } from 'node:crypto'
import { chmod, unlink } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { Server as HttpServer } from 'node:http'

import { getRequestListener } from '@hono/node-server'
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
import { removeDiscoveryFile, removeStaleSocket, writeDiscoveryFile } from './transport/discovery'
import { getDiscoveryPath, getSocketPath, platformHasUnixSockets } from './transport/paths'

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

export { fail, ok, type MCPContent, type MCPResult } from './result'

export { registerTools, type RegisterToolsOptions, type RpcSender } from './tool/registration'
export { paramToZod } from './tool/schema'

export interface ServerOptions {
  /** TCP port for the HTTP + WebSocket server. 0 to disable TCP. Defaults to 7600. */
  httpPort?: number
  /** Path to the Unix domain socket. Auto-resolved if omitted. */
  socketPath?: string | null
  /** Whether to also listen on TCP (in addition to the socket). */
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

  return app
}

/** Create an HTTP server bound to the Hono app. Each server can listen on one address. */
function createAppServer(app: Hono): HttpServer {
  const listener = getRequestListener(app.fetch)
  return createServer((req, res) => {
    void listener(req, res)
  })
}

/** Wire the HTTP upgrade handler onto a server. Each server needs its own. */
function wireUpgrade(server: HttpServer, wss: WebSocketServer) {
  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  })
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

/** Start socket listener; returns the resolved socket path, or null if skipped. */
async function startSocketListener(
  app: Hono,
  wss: WebSocketServer,
  socketPathOverride: string | null
): Promise<{ server: HttpServer; resolvedPath: string } | null> {
  if (!platformHasUnixSockets() && !socketPathOverride) return null

  const resolvedPath = socketPathOverride ?? (await getSocketPath())
  await removeStaleSocket(resolvedPath)

  const server = createAppServer(app)
  wireUpgrade(server, wss)

  const ss = server
  await new Promise<void>((resolve, reject) => {
    ss.listen(resolvedPath, () => resolve())
    ss.on('error', reject)
  })

  // NOTE: There is a brief TOCTOU window between listen() and chmod() below
  // where the socket file has default permissions (subject to process umask).
  // The auth token mitigates this — unauthenticated requests get 401 — but a
  // same-user process could connect before chmod. This is accepted as a known
  // limitation; calling process.umask(0o077) would close the window but has
  // global side effects.

  if (platformHasUnixSockets()) {
    try {
      await chmod(resolvedPath, 0o600)
    } catch (e) {
      if (e instanceof Error) process.stderr.write(`  Socket: chmod warning (${e.message})\n`)
    }
  }

  return { server, resolvedPath }
}

/** Start TCP listener; returns the server and actual port, or null if skipped. */
async function startTcpListener(
  app: Hono,
  wss: WebSocketServer,
  httpPort: number
): Promise<{ server: HttpServer; port: number } | null> {
  const host = '127.0.0.1'
  const server = createAppServer(app)
  wireUpgrade(server, wss)

  const ts = server
  const actualPort = await new Promise<number>((resolve, reject) => {
    ts.listen(httpPort, host, () => {
      const addr = ts.address()
      const port = typeof addr === 'object' && addr ? addr.port : httpPort
      resolve(port)
    })
    ts.on('error', reject)
  })

  return { server, port: actualPort }
}

async function writeDiscovery(
  resolvedSocketPath: string | null,
  actualHttpPort: number,
  authToken: string | null
): Promise<void> {
  await writeDiscoveryFile({
    pid: process.pid,
    socketPath: resolvedSocketPath ?? '',
    httpPort: actualHttpPort,
    authRequired: authToken !== null,
    authToken,
    version: MCP_VERSION,
    startedAt: new Date().toISOString()
  })
}

async function closeServer(srv: HttpServer | null): Promise<void> {
  if (!srv) return
  await new Promise<void>((resolve) => {
    srv.close(() => resolve())
  })
}

async function cleanupSocket(socketPath: string | null): Promise<void> {
  if (!socketPath || !platformHasUnixSockets()) return
  try {
    await unlink(socketPath)
  } catch (e) {
    if (e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code !== 'ENOENT') {
      process.stderr.write(`  Socket: cleanup warning (${e.message})\n`)
    }
  }
}

async function cleanupDiscovery(): Promise<void> {
  await removeDiscoveryFile().catch((e) => {
    process.stderr.write(`  Discovery: cleanup warning (${e instanceof Error ? e.message : e})\n`)
  })
}

interface ListenerState {
  socketResult: { server: HttpServer; resolvedPath: string } | null
  tcpResult: { server: HttpServer; port: number } | null
}

async function teardownListeners(state: ListenerState): Promise<void> {
  if (state.socketResult) {
    await closeServer(state.socketResult.server)
    await cleanupSocket(state.socketResult.resolvedPath)
  }
  if (state.tcpResult) {
    await closeServer(state.tcpResult.server)
  }
}

async function tryStartTcp(
  app: Hono,
  wss: WebSocketServer,
  httpPort: number,
  state: ListenerState
): Promise<{ server: HttpServer; port: number } | null> {
  try {
    return await startTcpListener(app, wss, httpPort)
  } catch (err) {
    // If TCP listener fails after the socket listener succeeded, close the
    // socket listener and clean up the socket file to avoid a leak.
    await teardownListeners(state)
    throw err
  }
}

async function tryWriteDiscovery(
  resolvedSocketPath: string | null,
  actualHttpPort: number,
  authToken: string | null,
  state: ListenerState
): Promise<void> {
  try {
    await writeDiscovery(resolvedSocketPath, actualHttpPort, authToken)
  } catch (err) {
    // If discovery file write fails after both listeners are up, tear down
    // both listeners so we never advertise a running server that clients
    // can't find via the discovery file.
    await teardownListeners(state)
    throw err
  }
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
  actualHttpPort: number
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

      await new Promise<void>((resolve) => {
        wss.close(() => resolve())
      })

      await teardownListeners(state)
      await cleanupDiscovery()
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

  const socketResult = await startSocketListener(ctx.app, ctx.wss, options.socketPath ?? null)
  const state: ListenerState = { socketResult, tcpResult: null }
  state.tcpResult = ctx.withTcp ? await tryStartTcp(ctx.app, ctx.wss, ctx.httpPort, state) : null
  const resolvedSocketPath = socketResult?.resolvedPath ?? null
  const actualHttpPort = state.tcpResult?.port ?? 0

  await tryWriteDiscovery(resolvedSocketPath, actualHttpPort, ctx.authToken, state)

  return buildHandle(
    ctx.app,
    ctx.wss,
    ctx.browserRpc,
    ctx.mcpSessions,
    state,
    resolvedSocketPath,
    actualHttpPort
  )
}
