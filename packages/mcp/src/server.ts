import { randomBytes } from 'node:crypto'
import type { Server as HttpServer } from 'node:http'

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { resolveCommand } from 'package-manager-detector/commands'
import { detect, getUserAgent } from 'package-manager-detector/detect'
import { WebSocketServer, type WebSocket } from 'ws'

import { bearerToken, isAuthorized, mcpRequestToken } from '#mcp/auth'
import { createBrowserRPCBridge } from '#mcp/browser-rpc'
import { MCP_CORS_HEADERS, MCP_CORS_METHODS, MCP_EXPOSED_HEADERS } from '#mcp/http-options'
import type { RPCJSONObject } from '#mcp/json'
import { preprocessRPC } from '#mcp/jsx-preprocess'
import { createMCPSessionManager } from '#mcp/server/sessions'
import { registerTools } from '#mcp/tool/registration'

import packageJSON from '../package.json' with { type: 'json' }
import {
  type ListenerState,
  cleanupDiscovery,
  closeWssGracefully,
  createAppServer,
  startSocketListener,
  teardownListeners,
  tryStartTcp,
  tryWriteDiscovery
} from './server/lifecycle'

export const MCP_VERSION: string = packageJSON.version

const HEARTBEAT_INTERVAL_MS = 5_000

let installCommandPromise: Promise<string> | null = null

async function resolveMCPInstallCommand(): Promise<string> {
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
  installCommandPromise ??= resolveMCPInstallCommand()
  return installCommandPromise
}

export { fail, ok, type MCPContent, type MCPResult } from '#mcp/result'

export { registerTools, type RegisterToolsOptions, type RPCSender } from '#mcp/tool/registration'
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
  /**
   * If set, the server starts a grace-period timer while no app is attached.
   * The timer closes the server and removes its discovery file unless an app
   * registers before it expires. A later app disconnect starts a new grace
   * period, which lets app-spawned servers survive brief reloads while still
   * cleaning up after renderer or process crashes. Undefined/0 disables the
   * watchdog — the default, since a bare CLI invocation for manual testing
   * should not self-terminate just because nobody connected yet. The desktop
   * app opts in when it spawns the server.
   */
  appAttachTimeoutMs?: number
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
  browserRPC: ReturnType<typeof createBrowserRPCBridge>
  mcpSessions: ReturnType<typeof createMCPSessionManager>
  sendToBrowser: (msg: RPCJSONObject) => Promise<unknown>
}): Hono {
  const { authToken, corsOrigin, browserRPC, mcpSessions, sendToBrowser } = options

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
      status: browserRPC.isConnected() ? 'ok' : 'no_app',
      version: MCP_VERSION,
      installCommand: await mcpInstallCommand(),
      authRequired: authToken !== null
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
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ error: 'Invalid request body' }, 400)
    }
    try {
      body = preprocessRPC(body as RPCJSONObject)
      const result = await sendToBrowser(body as RPCJSONObject)
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
    // For DELETE, look up the existing session without creating a new one.
    // resolveTransport() would allocate a fresh session for an unknown ID,
    // only to immediately delete it — wasting a session slot.
    if (c.req.method === 'DELETE' && sessionId) {
      const existing = mcpSessions.getExistingTransport(sessionId)
      if ('error' in existing) {
        if (existing.error === 'closed') {
          return c.json({ error: 'MCP server is shutting down' }, 503)
        }
        return c.json({ error: 'MCP session not found' }, 404)
      }
      try {
        return await existing.handleRequest(c.req.raw)
      } finally {
        mcpSessions.deleteSession(sessionId)
      }
    }
    if (sessionId) {
      const existing = mcpSessions.getExistingTransport(sessionId)
      if ('error' in existing) {
        if (existing.error === 'closed') {
          return c.json({ error: 'MCP server is shutting down' }, 503)
        }
        return c.json({ error: 'MCP session not found' }, 404)
      }
      mcpSessions.touch(sessionId, existing)
      return existing.handleRequest(c.req.raw)
    }
    const transport = await mcpSessions.resolveTransport(undefined)
    if ('error' in transport) {
      if (transport.error === 'closed') {
        return c.json({ error: 'MCP server is shutting down' }, 503)
      }
      return c.json(
        { error: 'Too many active MCP sessions' },
        { status: 503, headers: { 'Retry-After': '5' } }
      )
    }
    mcpSessions.touch(undefined, transport)
    return transport.handleRequest(c.req.raw)
  })

  return app
}

/** Set up shared WebSocket connection handling and heartbeat. Call once. */
function wireConnectionHandling(
  wss: WebSocketServer,
  browserRPC: ReturnType<typeof createBrowserRPCBridge>
) {
  const alive = new WeakMap<WebSocket, boolean>()

  wss.on('connection', (ws: WebSocket) => {
    alive.set(ws, true)
    browserRPC.handleConnection(ws)

    ws.on('pong', () => alive.set(ws, true))
    ws.on('message', (raw) => {
      alive.set(ws, true)
      const data = typeof raw === 'string' ? raw : Buffer.from(raw as Buffer).toString('utf-8')
      browserRPC.handleMessage(data, ws)
    })

    ws.on('close', () => {
      browserRPC.handleClose(ws)
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

  const mcpSessions = createMCPSessionManager({
    serverVersion: MCP_VERSION,
    registerTools: (mcpServer: McpServer) =>
      registerTools(mcpServer, { enableEval, mcpRoot, sendRPC: sendToBrowser })
  })
  const browserRPC = createBrowserRPCBridge({
    authToken,
    onConnectionChange: mcpSessions.notifyToolsChanged
  })
  const sendToBrowser = browserRPC.sendRPC

  const app = createHonoApp({ authToken, corsOrigin, browserRPC, mcpSessions, sendToBrowser })
  const wss = new WebSocketServer({ noServer: true })

  return { httpPort, withTcp, mcpSessions, browserRPC, sendToBrowser, app, wss, authToken }
}

/**
 * Unified runtime shutdown: closes browserRPC, clears MCP sessions,
 * terminates WebSocket clients, closes the WSS, and tears down HTTP
 * listeners. Used by both the startup catch block and ServerHandle.close()
 * to ensure no runtime resources (WebSocket, browserRPC, mcpSessions) are
 * left alive.
 */
async function shutdownRuntime(
  browserRPC: ReturnType<typeof createBrowserRPCBridge>,
  mcpSessions: ReturnType<typeof createMCPSessionManager>,
  wss: WebSocketServer,
  state: ListenerState
): Promise<void> {
  const errors: unknown[] = []
  try {
    browserRPC.close()
  } catch (e) {
    errors.push(e)
  }
  try {
    await mcpSessions.clear()
  } catch (e) {
    errors.push(e)
  }
  try {
    await closeWssGracefully(wss)
  } catch (e) {
    errors.push(e)
  }
  try {
    await teardownListeners(state)
  } catch (e) {
    errors.push(e)
  }
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1) throw new AggregateError(errors, 'Multiple shutdown errors')
}

function buildHandle(
  app: Hono,
  wss: WebSocketServer,
  browserRPC: ReturnType<typeof createBrowserRPCBridge>,
  mcpSessions: ReturnType<typeof createMCPSessionManager>,
  state: ListenerState,
  resolvedSocketPath: string | null,
  actualHttpPort: number,
  authToken: string | null,
  startedAt: string
): ServerHandle {
  // Promise-based lock ensures idempotency even under concurrent calls:
  // the first call creates the teardown promise; subsequent calls return
  // the same promise. JavaScript's event loop guarantees no preemption
  // between the guard check and the assignment.
  let closePromise: Promise<void> | null = null

  async function close() {
    if (closePromise) return closePromise
    closePromise = (async () => {
      const errors: unknown[] = []
      try {
        // Stop advertising this process before the slower WebSocket grace
        // period. This also makes signal-driven shutdown resilient when a
        // parent process exits before all clients finish closing.
        await cleanupDiscovery(authToken, resolvedSocketPath, actualHttpPort, startedAt)
      } catch (error) {
        errors.push(error)
      }
      try {
        await shutdownRuntime(browserRPC, mcpSessions, wss, state)
      } catch (error) {
        errors.push(error)
      }
      if (errors.length === 1) throw errors[0]
      if (errors.length > 1) throw new AggregateError(errors, 'Multiple shutdown errors')
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
  validateAppAttachTimeout(options.appAttachTimeoutMs)
  const ctx = buildServerContext(options)

  // Wire shared connection handling BEFORE starting listeners so that
  // any client connecting during startup is handled immediately.
  wireConnectionHandling(ctx.wss, ctx.browserRPC)

  const state: ListenerState = { socketResult: null, tcpResult: null }
  let startedAt = ''
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

    startedAt = await tryWriteDiscovery(
      resolvedSocketPath,
      actualHttpPort,
      ctx.authToken,
      MCP_VERSION,
      state
    )
  } catch (err) {
    // Tear down any listeners that started before the failure, then close
    // all resources so nothing leaks when startServer rejects.
    await shutdownRuntime(ctx.browserRPC, ctx.mcpSessions, ctx.wss, state).catch(() => undefined)
    throw err
  }

  const resolvedSocketPath = state.socketResult?.resolvedPath ?? null
  const actualHttpPort = state.tcpResult?.port ?? 0

  const handle = buildHandle(
    ctx.app,
    ctx.wss,
    ctx.browserRPC,
    ctx.mcpSessions,
    state,
    resolvedSocketPath,
    actualHttpPort,
    ctx.authToken,
    startedAt
  )

  armAppAttachWatchdog(options.appAttachTimeoutMs, ctx.browserRPC, handle)

  return handle
}

const MAX_TIMER_MS = 2_147_483_647

function validateAppAttachTimeout(timeoutMs: number | undefined): void {
  if (timeoutMs === undefined) return
  if (!Number.isSafeInteger(timeoutMs)) {
    throw new RangeError('appAttachTimeoutMs must be a safe integer')
  }
  if (timeoutMs < 0 || timeoutMs > MAX_TIMER_MS) {
    throw new RangeError(`appAttachTimeoutMs must be in the range 0–${MAX_TIMER_MS}`)
  }
}

/**
 * Closes an app-spawned server after it remains unattached for the configured
 * grace period. Registering an app cancels the pending shutdown; disconnecting
 * starts a fresh grace period so renderer reloads can reconnect without
 * leaving a permanently orphaned process behind.
 */
function armAppAttachWatchdog(
  timeoutMs: number | undefined,
  browserRPC: ReturnType<typeof createBrowserRPCBridge>,
  handle: ServerHandle
): void {
  if (timeoutMs === undefined || timeoutMs === 0) return

  let timer: ReturnType<typeof setTimeout> | null = null
  let closing = false
  const clearTimer = () => {
    if (!timer) return
    clearTimeout(timer)
    timer = null
  }
  const armTimer = () => {
    clearTimer()
    timer = setTimeout(() => {
      timer = null
      if (browserRPC.isConnected() || closing) return
      closing = true
      unsubscribe()
      void handle.close().catch((e) => {
        console.error('[MCP] Watchdog: failed to close orphaned (no_app) server:', e)
      })
    }, timeoutMs)
    timer.unref()
  }
  const unsubscribe = browserRPC.subscribeConnectionChange((connected) => {
    if (connected) clearTimer()
    else armTimer()
  })
}
