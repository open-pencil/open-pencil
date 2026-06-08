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

const RPC_TIMEOUT = 30_000
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

  let resolvedAuthToken: string | null = authToken ?? null

  async function resolveAuthToken(): Promise<string | null> {
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
    if (info?.socketPath) {
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
        reject(new Error('RPC timeout (30s)'))
      }, RPC_TIMEOUT)

      httpRequest('POST', '/rpc', body)
        .then(({ status, data, req }) => {
          if (settled) {
            req.destroy()
            return
          }
          clearTimeout(timer)
          if (status === 503) {
            // Server reported app not connected — the server waits for the
            // app internally, so this should be rare. Just surface the error.
            reject(new Error(DISCONNECTED_MESSAGE))
            return
          }
          if (status === 401) {
            // Token may have rotated — clear cache and reconnect to re-read discovery file
            resolvedAuthToken = null
            // Also clear transport mode so resolveTransport() re-reads the
            // discovery file in case the server restarted with a different
            // socket path or port.
            transportMode = null
            ready = false
            scheduleReconnect()
            reject(new Error('Unauthorized: check OPENPENCIL_MCP_AUTH_TOKEN'))
            return
          }
          if (status >= 400) {
            const errData = data as { error?: string }
            reject(new Error(errData.error ?? `RPC failed with status ${status}`))
            return
          }
          resolve(data)
        })
        .catch(() => {
          if (settled) return
          clearTimeout(timer)
          transportMode = null
          ready = false
          scheduleReconnect()
          reject(new Error(DISCONNECTED_MESSAGE))
        })
    })
  }

  // Start connection
  void connect()

  return { sendRpc }
}
