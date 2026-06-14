import { randomBytes } from 'node:crypto'
import { chmod, mkdir, readFile, unlink } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { Server as HttpServer } from 'node:http'
import { dirname } from 'node:path'

import { getRequestListener } from '@hono/node-server'
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
import {
  removeDiscoveryFile,
  removeStaleSocket,
  writeDiscoveryFile
} from '#mcp/transport/discovery'
import {
  getDiscoveryPath,
  getSocketDir,
  getSocketPath,
  platformHasUnixSockets
} from '#mcp/transport/paths'

import packageJson from '../package.json' with { type: 'json' }

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
  /** TCP port for the HTTP + WebSocket server. 0 to disable TCP. Defaults to 7600. */
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
  // Unix domain sockets are not available on Windows — always use TCP there,
  // even when a socketPath override is provided.
  if (!platformHasUnixSockets()) return null

  const resolvedPath = socketPathOverride ?? (await getSocketPath())
  if (socketPathOverride) {
    // Create the parent directory for the caller-provided socket path.
    // Skip getSocketDir() — it would create the platform-default directory
    // (or the OPENPENCIL_MCP_SOCKET env dir) which is unrelated to this path.
    await mkdir(dirname(resolvedPath), { recursive: true })
  } else {
    // Ensure the default platform socket directory exists.
    await getSocketDir()
  }
  await removeStaleSocket(resolvedPath)

  const server = createAppServer(app)
  wireUpgrade(server, wss)

  const ss = server
  await new Promise<void>((resolve, reject) => {
    ss.on('error', reject)
    ss.listen(resolvedPath, () => {
      ss.off('error', reject)
      resolve()
    })
  })

  // NOTE: There is a brief TOCTOU window between listen() and chmod() below
  // where the socket file has default permissions (subject to process umask).
  // The auth token mitigates this — unauthenticated requests get 401 — but a
  // same-user process could connect before chmod. This is accepted as a known
  // limitation; calling process.umask(0o077) would close the window but has
  // global side effects.

  try {
    await chmod(resolvedPath, 0o600)
  } catch (e) {
    if (e instanceof Error) process.stderr.write(`  Socket: chmod warning (${e.message})\n`)
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
    ts.on('error', reject)
    ts.listen(httpPort, host, () => {
      ts.off('error', reject)
      const addr = ts.address()
      const port = typeof addr === 'object' && addr ? addr.port : httpPort
      resolve(port)
    })
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
  // Close all idle keep-alive connections first to prevent server.close()
  // from hanging indefinitely on persistent HTTP connections.
  srv.closeIdleConnections()
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

async function cleanupDiscovery(
  ownAuthToken: string | null,
  ownSocketPath: string | null,
  ownHttpPort: number
): Promise<void> {
  // Only remove the discovery file if it was written by this server instance.
  // Without this guard, closing one of two concurrent servers can delete the
  // other's discovery file, breaking auto-discovery for the surviving server.
  // We verify all three identifying fields (authToken, socketPath, httpPort)
  // to handle the case where authToken is null (auth disabled) and two
  // servers share the same null token.
  const discoveryPath = await getDiscoveryPath()
  try {
    const raw = await readFile(discoveryPath, 'utf-8')
    const info = JSON.parse(raw) as {
      authToken: string | null
      socketPath?: string
      httpPort?: number
    }
    // If any identifying field doesn't match, another server owns the file.
    // Compare unconditionally (not truthy-gated) so that null/0 values
    // are treated as required equality checks, not wildcards.
    if (info.authToken !== ownAuthToken) return
    if (info.socketPath !== (ownSocketPath ?? '')) return
    if (info.httpPort !== ownHttpPort) return
  } catch {
    // File doesn't exist or can't be parsed — fall through to removeDiscoveryFile
    // which handles ENOENT gracefully.
    void 0
  }
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
        }, 2_000)
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

    await tryWriteDiscovery(resolvedSocketPath, actualHttpPort, ctx.authToken, state)
  } catch (err) {
    // Tear down any listeners that started before the failure, then close
    // the WebSocket server so no resources leak when startServer rejects.
    await teardownListeners(state).catch(() => undefined)
    ctx.wss.close()
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
