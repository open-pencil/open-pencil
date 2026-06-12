import { request } from 'node:http'
import type { ClientRequest, RequestOptions } from 'node:http'

import { readDiscoveryFile } from './transport/discovery'
import { getSocketPath, platformHasUnixSockets } from './transport/paths'

type StdioRpcBridgeOptions = {
  /** Override socket path (if known). Auto-discovered if omitted. */
  socketPath?: string | null
  /** Auth token for /rpc Bearer header. */
  authToken?: string | null
  reconnectDelayMs?: number
  onReady?: () => void
  onReconnect?: () => void
}

// 35s gives a 5s margin over the worst case (10s app wait + 20s RPC timeout = 30s)
const RPC_TIMEOUT = 35_000
const DISCONNECTED_MESSAGE =
  'OpenPencil app is not connected. ' +
  'STOP and tell the user: "The OpenPencil desktop app is not running or no document is open. ' +
  'Please start the app and open a document, then try again." ' +
  'Do NOT attempt to start the app yourself or retry automatically.'

type TransportMode = 'socket' | 'tcp'

/**
 * Creates an RPC bridge that connects to the MCP server via HTTP
 * over a Unix domain socket.
 *
 * This replaces the previous WebSocket-based bridge with a simpler
 * HTTP approach that natively supports Unix domain sockets.
 */
export function createStdioRpcBridge({
  socketPath: socketPathOverride,
  authToken,
  reconnectDelayMs = 2000,
  onReady,
  onReconnect
}: StdioRpcBridgeOptions) {
  let resolvedSocketPath: string | null = socketPathOverride ?? null
  let resolvedHttpPort: number | null = null
  let transportMode: TransportMode | null = null
  let ready = false
  let wasConnected = false
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined

  // Track whether the socket path was explicitly provided by the caller
  // via the socketPath option. When true, discovery updates must not
  // overwrite it — the caller knows the socket path and it shouldn't
  // change. When false, the socket path comes from auto-discovery
  // (readDiscoveryFile or getSocketPath) and should be refreshed on
  // reconnect.
  // Note: OPENPENCIL_MCP_SOCKET is handled through getSocketPath() and
  // readDiscoveryFile(), not through this flag — it's an env var that
  // affects path resolution, not a direct parameter.
  const hasExplicitSocketPath = socketPathOverride !== undefined && socketPathOverride !== null
  // Track whether authToken was explicitly provided by the caller.
  // When false, the token is auto-discovered from the discovery file and
  // can be refreshed transparently on 401 without surfacing the error.
  const hasExplicitAuth = authToken !== undefined
  let resolvedAuthToken: string | null = authToken ?? null

  async function resolveAuthToken(): Promise<string | null> {
    if (hasExplicitAuth) return resolvedAuthToken
    if (resolvedAuthToken) return resolvedAuthToken
    const info = await readDiscoveryFile()
    if (info?.authToken) {
      resolvedAuthToken = info.authToken
    }
    return resolvedAuthToken
  }

  async function resolveTransport(): Promise<void> {
    // Already resolved
    if (transportMode) return

    // Try reading the discovery file
    const info = await readDiscoveryFile()

    // When the auth token was not explicitly provided, pick it up from the
    // discovery file whenever we re-read transport info. This ensures the
    // bridge picks up a new server-generated token after a restart without
    // waiting for a 401 response.
    if (!hasExplicitAuth && info?.authToken) {
      resolvedAuthToken = info.authToken
    }

    // When no Unix socket is available, prefer TCP via httpPort
    if (!platformHasUnixSockets()) {
      if (info?.httpPort) {
        resolvedHttpPort = info.httpPort
        transportMode = 'tcp'
        return
      }
      throw new Error('No MCP server discovery info found')
    }

    // Unix: prefer socket path from discovery file, fall back to default.
    // If no socket is available (TCP-only server), use TCP via httpPort.
    // Caller-provided socket paths (OPENPENCIL_MCP_SOCKET or the socketPath
    // option) take precedence and are never overwritten by discovery.
    if (hasExplicitSocketPath && resolvedSocketPath) {
      // Caller explicitly provided a socket path — keep it, never overwrite
    } else if (info?.socketPath) {
      resolvedSocketPath = info.socketPath
    } else if (info?.httpPort) {
      // Server is TCP-only (no socket listener) — use TCP
      resolvedHttpPort = info.httpPort
      transportMode = 'tcp'
      return
    } else {
      resolvedSocketPath = await getSocketPath()
    }

    // Also capture httpPort as fallback
    if (info?.httpPort) {
      resolvedHttpPort = info.httpPort
    }

    transportMode = 'socket'
  }

  /**
   * Makes an HTTP request to the MCP server via socket or TCP.
   */
  function httpRequest(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<{ status: number; data: unknown; req: ClientRequest }> {
    return new Promise((resolve, reject) => {
      const bodyJson = body ? JSON.stringify(body) : undefined
      const headers: Record<string, string> = {
        ...(bodyJson ? { 'Content-Type': 'application/json' } : {}),
        ...(resolvedAuthToken ? { Authorization: `Bearer ${resolvedAuthToken}` } : {})
      }

      let reqOpts: RequestOptions | null = null
      if (transportMode === 'socket' && resolvedSocketPath) {
        reqOpts = { socketPath: resolvedSocketPath, path, method, headers }
      } else if (transportMode === 'tcp' && resolvedHttpPort) {
        reqOpts = { hostname: '127.0.0.1', port: resolvedHttpPort, path, method, headers }
      }

      if (!reqOpts) {
        reject(new Error(DISCONNECTED_MESSAGE))
        return
      }

      const req = request(reqOpts, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8')
          let data: unknown
          try {
            data = JSON.parse(raw)
          } catch {
            data = raw
          }
          resolve({ status: res.statusCode ?? 200, data, req })
        })
        res.on('error', reject)
      })

      req.on('error', reject)
      // Socket-level idle timeout to prevent indefinite hangs on
      // unresponsive connections. Set 5s shorter than the outer RPC_TIMEOUT
      // so this fires deterministically first, producing a clear "server
      // unreachable" signal rather than racing with the outer timer.
      // If the outer sendRpc timer already rejected, the error handler
      // is a no-op (settled guard in attempt()).
      req.setTimeout(RPC_TIMEOUT - 5_000, () => {
        req.destroy(new Error('Socket timeout'))
      })
      if (bodyJson) req.write(bodyJson)
      req.end()
    })
  }

  /**
   * Checks if the server is healthy and the browser is connected.
   */
  async function checkHealth(): Promise<{ reachable: boolean; appConnected: boolean }> {
    try {
      const { status, data } = await httpRequest('GET', '/health')
      if (status !== 200) return { reachable: false, appConnected: false }
      const health = data as { status?: string }
      return {
        reachable: health.status === 'ok' || health.status === 'no_app',
        appConnected: health.status === 'ok'
      }
    } catch {
      return { reachable: false, appConnected: false }
    }
  }

  /**
   * Attempts to connect to the server. Retries with a fixed delay.
   */
  async function connect(): Promise<void> {
    try {
      await resolveTransport()
      if (!resolvedAuthToken) await resolveAuthToken()
    } catch {
      scheduleReconnect()
      return
    }

    const { reachable, appConnected } = await checkHealth()
    if (appConnected) {
      ready = true
      if (wasConnected) {
        onReconnect?.()
      } else {
        wasConnected = true
        onReady?.()
      }
      return
    }

    if (reachable) {
      // Server is up — we can send RPC requests and let the server
      // wait for the desktop app to connect.
      ready = true
      if (!wasConnected) {
        wasConnected = true
        onReady?.()
      }
      return
    }

    scheduleReconnect()
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(() => {
      void connect()
    }, reconnectDelayMs)
    reconnectTimer.unref()
  }

  /**
   * Sends an RPC request to the MCP server.
   *
   * Routes through the /rpc HTTP endpoint, which proxies
   * the call to the connected browser.
   *
   * When using an auto-discovered auth token (hasExplicitAuth === false),
   * a 401 response triggers a transparent retry: the cached token is cleared,
   * the discovery file is re-read for a fresh token, and the request is
   * retried once. Only if the retry also fails is the error surfaced to the
   * caller. This makes server restarts with a new auto-generated token
   * seamless to the AI agent.
   */
  function sendRpc(body: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!ready) {
        reject(new Error(DISCONNECTED_MESSAGE))
        return
      }

      let settled = false
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        reject(new Error(`RPC timeout (${Math.round(RPC_TIMEOUT / 1000)}s)`))
      }, RPC_TIMEOUT)

      /**
       * Performs one HTTP request attempt. `allowAuthRetry` controls whether
       * a 401 with an auto-discovered token triggers a re-read and retry.
       * It is set to `false` for the second attempt to prevent infinite loops.
       */
      function attempt(allowAuthRetry: boolean) {
        httpRequest('POST', '/rpc', body)
          .then(({ status, data, req }) => {
            // If the overall RPC timeout fired while the request was in-flight,
            // the server may have already executed the tool. Destroying the
            // request only closes the TCP socket — it does not roll back any
            // server-side mutation. Callers must not assume that a timeout
            // means the operation was not executed.
            if (settled) {
              req.destroy()
              return
            }

            if (status === 401) {
              if (allowAuthRetry && !hasExplicitAuth) {
                // Auto-discovered token may have rotated — re-read the
                // discovery file for a fresh token and retry transparently.
                // IMPORTANT: Do NOT clear the timer here — the retry must
                // still be protected by the overall 35-second timeout.
                resolvedAuthToken = null
                void readDiscoveryFile()
                  .then((info) => {
                    if (info?.authToken) {
                      resolvedAuthToken = info.authToken
                      // Keep existing transport mode (socket path / port
                      // doesn't change on server restart — only the token
                      // does). Retry exactly once with the new token.
                      attempt(false)
                    } else {
                      clearTimeout(timer)
                      settled = true
                      scheduleReconnect()
                      reject(new Error('Unauthorized'))
                    }
                  })
                  .catch(() => {
                    clearTimeout(timer)
                    settled = true
                    scheduleReconnect()
                    reject(new Error(DISCONNECTED_MESSAGE))
                  })
                return
              }

              // Explicit token was rejected (config error), or auto-retry
              // already failed — surface the error immediately.
              clearTimeout(timer)
              if (!hasExplicitAuth) {
                resolvedAuthToken = null
              }
              transportMode = null
              // Clear auto-discovered transport params so resolveTransport()
              // picks up fresh values from the discovery file on reconnect.
              if (!hasExplicitSocketPath) resolvedSocketPath = null
              resolvedHttpPort = null
              ready = false
              settled = true
              scheduleReconnect()
              reject(new Error('Unauthorized: check OPENPENCIL_MCP_AUTH_TOKEN'))
              return
            }

            clearTimeout(timer)

            if (status >= 400) {
              const errData = data as { error?: string }
              settled = true
              reject(new Error(errData.error ?? `RPC failed with status ${status}`))
              return
            }
            settled = true
            resolve(data)
          })
          .catch(() => {
            if (settled) return
            clearTimeout(timer)
            transportMode = null
            // Clear auto-discovered transport params so resolveTransport()
            // picks up fresh values from the discovery file on reconnect.
            if (!hasExplicitSocketPath) resolvedSocketPath = null
            resolvedHttpPort = null
            ready = false
            settled = true
            scheduleReconnect()
            reject(new Error(DISCONNECTED_MESSAGE))
          })
      }

      attempt(true)
    })
  }

  // Start connection
  void connect()

  return { sendRpc }
}
