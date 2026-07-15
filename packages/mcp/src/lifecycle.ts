import { access, chmod, constants, mkdir, readFile, unlink } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { Server as HttpServer } from 'node:http'
import { connect } from 'node:net'
import { dirname } from 'node:path'

import { getRequestListener } from '@hono/node-server'
import type { Hono } from 'hono'
import type { WebSocketServer } from 'ws'

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

/** Create an HTTP server bound to the Hono app. Each server can listen on one address. */
export function createAppServer(app: Hono): HttpServer {
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

/** Start socket listener; returns the resolved socket path, or null if skipped. */
export async function startSocketListener(
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
    // For newly-created parent directories, request mode 0o700 to restrict
    // access to the same OS user; existing directories are left unchanged
    // (mkdir with recursive:true does not chmod existing dirs). The socket
    // file itself is later chmodded to 0o600, and the auth token provides
    // the primary defense against unauthorized access.
    await mkdir(dirname(resolvedPath), { recursive: true, mode: 0o700 })
  } else {
    // Ensure the default platform socket directory exists.
    await getSocketDir()
  }
  await removeStaleSocket(resolvedPath)

  // Bun on Linux silently replaces existing Unix socket files on listen().
  // If removeStaleSocket left the file in place (live server detected),
  // throw EADDRINUSE to match Node.js/macOS behavior.
  const socketStillExists = await access(resolvedPath, constants.F_OK)
    .then(() => true)
    .catch(() => false)
  if (socketStillExists) {
    const err = new Error(
      `listen EADDRINUSE: address already in use ${resolvedPath}`
    ) as NodeJS.ErrnoException
    err.code = 'EADDRINUSE'
    throw err
  }

  const server = createAppServer(app)
  wireUpgrade(server, wss)

  const ss = server
  ss.on('error', (err) => console.error('[MCP] Socket server error:', err))
  await new Promise<void>((resolve, reject) => {
    ss.on('error', reject)
    ss.listen(resolvedPath, () => {
      ss.off('error', reject)
      resolve()
    })
  }).catch((err) => {
    ss.removeAllListeners('error')
    server.close(() => {
      void 0
    })
    throw err
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
    // Fail closed: if we cannot restrict socket permissions, refuse to
    // serve on this socket. A world-readable socket with auth disabled
    // (OPENPENCIL_MCP_AUTH_TOKEN="") is a security hole.
    await closeServer(server).catch(() => undefined)
    await cleanupSocket(resolvedPath).catch(() => undefined)
    throw new Error(
      `Socket chmod failed — refusing to serve with insecure permissions: ${e instanceof Error ? e.message : String(e)}`
    )
  }

  return { server, resolvedPath }
}

/** Start TCP listener; returns the server and actual port, or null if skipped. */
export async function startTcpListener(
  app: Hono,
  wss: WebSocketServer,
  httpPort: number
): Promise<{ server: HttpServer; port: number } | null> {
  const host = '127.0.0.1'
  const server = createAppServer(app)
  wireUpgrade(server, wss)

  const ts = server
  ts.on('error', (err) => console.error('[MCP] TCP server error:', err))
  const actualPort = await new Promise<number>((resolve, reject) => {
    ts.on('error', reject)
    ts.listen(httpPort, host, () => {
      ts.off('error', reject)
      const addr = ts.address()
      const port = typeof addr === 'object' && addr ? addr.port : httpPort
      resolve(port)
    })
  }).catch((err) => {
    ts.removeAllListeners('error')
    server.close(() => {
      void 0
    })
    throw err
  })

  return { server, port: actualPort }
}

export async function writeDiscovery(
  resolvedSocketPath: string | null,
  actualHttpPort: number,
  authToken: string | null,
  version: string
): Promise<string> {
  const startedAt = new Date().toISOString()
  await writeDiscoveryFile({
    pid: process.pid,
    socketPath: resolvedSocketPath,
    httpPort: actualHttpPort,
    authRequired: authToken !== null,
    authToken,
    version,
    startedAt
  })
  return startedAt
}

export async function closeServer(srv: HttpServer | null): Promise<void> {
  if (!srv) return
  // Close all idle keep-alive connections first to prevent server.close()
  // from hanging indefinitely on persistent HTTP connections.
  srv.closeIdleConnections()
  // If any stubborn connections remain after 5 seconds, force-close them
  // so the server shutdown can complete. Without this, a misbehaving HTTP
  // client with an active request can block shutdown indefinitely.
  const forceClose = setTimeout(() => {
    srv.closeAllConnections()
    srv.close()
  }, 5_000).unref()
  try {
    await new Promise<void>((resolve) => {
      srv.close(() => resolve())
    })
  } finally {
    clearTimeout(forceClose)
  }
}

export async function cleanupSocket(socketPath: string | null): Promise<void> {
  if (!socketPath || !platformHasUnixSockets()) return
  // Only remove the socket if no other server is listening on it.
  // A replacement server that won the restart race may have already
  // bound the same path — unlinking it would kill the replacement.
  try {
    const alive = await new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (value: boolean) => {
        if (settled) return
        settled = true
        client.destroy()
        resolve(value)
      }
      const client = connect(socketPath)
        .on('connect', () => finish(true))
        .on('error', (err: NodeJS.ErrnoException) => {
          // Only ECONNREFUSED and ENOENT mean "nobody is listening".
          // All other errors (EACCES, ECONNRESET, etc.) are treated as
          // "alive" to avoid unlinking a live replacement server's socket.
          const isDead = err.code === 'ECONNREFUSED' || err.code === 'ENOENT'
          finish(!isDead)
        })
      // Fail fast — we only need to know if something is listening.
      // Treat timeout as inconclusive (alive) rather than dead: during
      // system restarts or high load, a timeout doesn't reliably indicate
      // nobody is listening. Being conservative prevents unlinking a live
      // replacement server's socket.
      client.setTimeout(500, () => finish(true))
    })
    if (alive) return // Another server owns this socket — leave it alone.
  } catch {
    // Connection test itself failed (unlikely) — fall through to unlink.
    void 0
  }
  try {
    await unlink(socketPath)
  } catch (e) {
    if (e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code !== 'ENOENT') {
      process.stderr.write(`  Socket: cleanup warning (${e.message})\n`)
    }
  }
}

export async function cleanupDiscovery(
  ownAuthToken: string | null,
  ownSocketPath: string | null,
  ownHttpPort: number,
  ownStartedAt: string
): Promise<void> {
  // Only remove the discovery file if it was written by this server instance.
  // Without this guard, closing one of two concurrent servers can delete the
  // other's discovery file, breaking auto-discovery for the surviving server.
  // We verify all four identifying fields (authToken, socketPath, httpPort,
  // startedAt) to handle the case where authToken is null (auth disabled) and
  // two servers share the same null token. The startedAt timestamp uniquely
  // identifies the instance since two servers starting at the exact same
  // millisecond is extremely unlikely.
  const discoveryPath = await getDiscoveryPath()
  try {
    const raw = await readFile(discoveryPath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return
    const info = parsed as {
      authToken: string | null
      socketPath?: string | null
      httpPort?: number
      startedAt?: string
    }
    if (info.authToken !== ownAuthToken) return
    if (info.socketPath !== ownSocketPath) return
    if (info.httpPort !== ownHttpPort) return
    if (info.startedAt !== ownStartedAt) return
  } catch {
    return
  }
  await removeDiscoveryFile().catch((e) => {
    process.stderr.write(`  Discovery: cleanup warning (${e instanceof Error ? e.message : e})\n`)
  })
}

export interface ListenerState {
  socketResult: { server: HttpServer; resolvedPath: string } | null
  tcpResult: { server: HttpServer; port: number } | null
}

export async function teardownListeners(state: ListenerState): Promise<void> {
  if (state.socketResult) {
    await closeServer(state.socketResult.server)
    await cleanupSocket(state.socketResult.resolvedPath)
  }
  if (state.tcpResult) {
    await closeServer(state.tcpResult.server)
  }
}

/**
 * Close the WebSocket server with a grace period. Prevents new connections,
 * then terminates any lingering clients after 2 seconds to ensure shutdown
 * completes promptly even with unresponsive clients.
 */
export async function closeWssGracefully(wss: WebSocketServer): Promise<void> {
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
}

export async function tryStartTcp(
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

export async function tryWriteDiscovery(
  resolvedSocketPath: string | null,
  actualHttpPort: number,
  authToken: string | null,
  version: string,
  state: ListenerState
): Promise<string> {
  try {
    return await writeDiscovery(resolvedSocketPath, actualHttpPort, authToken, version)
  } catch (err) {
    // If discovery file write fails after both listeners are up, tear down
    // both listeners so we never advertise a running server that clients
    // can't find via the discovery file.
    await teardownListeners(state)
    throw err
  }
}
