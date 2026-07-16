import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, rm, unlink, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createStdioRpcBridge } from '#mcp/stdio-bridge'
import { getDiscoveryPath } from '#mcp/transport/paths'

const isUnix = process.platform !== 'win32'
const TEST_DIR = join(tmpdir(), `openpencil-test-bridge-reconnect-${process.pid}`)
const SOCKET_PATH = join(TEST_DIR, 'mcp-test.sock')
const SOCKET_PATH_2 = join(TEST_DIR, 'mcp-test-v2.sock')
const AUTH_TOKEN = 'test-reconnect-token'

/**
 * Writes a mock discovery file at the platform discovery path so the
 * bridge's readDiscoveryFile() finds it.
 */
async function writeMockDiscovery(
  socketPath: string,
  authToken: string | null,
  httpPort: number = 0
): Promise<void> {
  const discoveryPath = await getDiscoveryPath()
  await writeFile(
    discoveryPath,
    JSON.stringify({
      pid: process.pid,
      socketPath,
      httpPort,
      authRequired: authToken !== null,
      authToken,
      version: '0.1.0-test',
      startedAt: new Date().toISOString()
    }),
    'utf-8'
  )
}

/**
 * Minimal HTTP server on a Unix socket that mimics the MCP /health
 * and /rpc endpoints.
 */
function createMockMcpServer(
  socketPath: string,
  options: { authToken?: string | null; label?: string } = {}
): Promise<Server> {
  const { authToken = null, label = 'default' } = options

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok' }))
        return
      }

      if (req.url === '/rpc' && req.method === 'POST') {
        const auth = req.headers.authorization
        if (authToken && auth !== `Bearer ${authToken}`) {
          res.writeHead(401)
          res.end(JSON.stringify({ error: 'Unauthorized' }))
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        // Include the label so callers can verify which server responded
        res.end(JSON.stringify({ result: `ok-${label}` }))
        return
      }

      res.writeHead(404)
      res.end(JSON.stringify({ error: 'not found' }))
    })

    server.once('error', reject)
    server.listen(socketPath, () => {
      server.off('error', reject)
      resolve(server)
    })
  })
}

/**
 * Creates a stdio bridge and returns a Promise that resolves once onReady
 * fires (meaning the initial health check passed).
 */
async function createBridgeAndWaitForReady(
  options: Parameters<typeof createStdioRpcBridge>[0]
): Promise<ReturnType<typeof createStdioRpcBridge>> {
  const TIMEOUT_MS = 5_000

  return new Promise((resolve, reject) => {
    let bridge: ReturnType<typeof createStdioRpcBridge> | null = null

    const timer = setTimeout(() => {
      bridge?.close()
      reject(new Error('Bridge never became ready'))
    }, TIMEOUT_MS)

    bridge = createStdioRpcBridge({
      ...options,
      onReady: () => {
        clearTimeout(timer)
        resolve(bridge as ReturnType<typeof createStdioRpcBridge>)
      }
    })
  })
}

/**
 * Closes a server gracefully, removing the socket file if it exists.
 */
async function closeMockServer(server: Server | null, socketPath?: string): Promise<void> {
  if (!server) return
  await new Promise<void>((resolve) => {
    server.close(() => resolve())
  })
  if (socketPath && existsSync(socketPath)) {
    try {
      await unlink(socketPath)
    } catch {
      void 0 // best-effort
    }
  }
}

// ---------------------------------------------------------------------------
// Tests for stdio-bridge transport state management on reconnect
// ---------------------------------------------------------------------------

describe('stdio-bridge transport reconnection', () => {
  const origSocketEnv = process.env.OPENPENCIL_MCP_SOCKET

  afterEach(async () => {
    if (origSocketEnv === undefined) {
      delete process.env.OPENPENCIL_MCP_SOCKET
    } else {
      process.env.OPENPENCIL_MCP_SOCKET = origSocketEnv
    }
    try {
      const discoveryPath = await getDiscoveryPath()
      if (existsSync(discoveryPath)) await unlink(discoveryPath)
    } catch {
      void 0 // best-effort cleanup
    }
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  test.skipIf(!isUnix)(
    'bridge reconnects after server restart on the same socket path',
    async () => {
      let server1: Server | null = null
      let server2: Server | null = null
      let bridge: ReturnType<typeof createStdioRpcBridge> | null = null

      try {
        await mkdir(TEST_DIR, { recursive: true })
        await writeMockDiscovery(SOCKET_PATH, AUTH_TOKEN)
        process.env.OPENPENCIL_MCP_SOCKET = SOCKET_PATH

        // Start server
        server1 = await createMockMcpServer(SOCKET_PATH, {
          authToken: AUTH_TOKEN,
          label: 'first'
        })

        // Create bridge with explicit socket path
        bridge = await createBridgeAndWaitForReady({
          socketPath: SOCKET_PATH,
          authToken: AUTH_TOKEN,
          reconnectDelayMs: 300
        })

        // Verify initial connection
        const result1 = await bridge.sendRpc({ command: 'test' })
        expect(result1).toEqual({ result: 'ok-first' })

        // Kill server
        await closeMockServer(server1, SOCKET_PATH)
        server1 = null

        // RPC should fail (connection refused)
        await expect(bridge.sendRpc({ command: 'test' })).rejects.toThrow()

        // Restart server on the same socket
        server2 = await createMockMcpServer(SOCKET_PATH, {
          authToken: AUTH_TOKEN,
          label: 'second'
        })

        // Wait for the bridge to reconnect by polling sendRpc
        let reconnected = false
        for (let i = 0; i < 20; i++) {
          try {
            const result = await bridge.sendRpc({ command: 'test' })
            expect(result).toEqual({ result: 'ok-second' })
            reconnected = true
            break
          } catch {
            await new Promise<void>((r) => {
              setTimeout(r, 300)
            })
          }
        }
        expect(reconnected).toBe(true)
      } finally {
        bridge?.close()
        bridge = null
        await closeMockServer(server1, SOCKET_PATH)
        await closeMockServer(server2, SOCKET_PATH)
      }
    },
    15_000
  )

  test.skipIf(!isUnix)(
    'auto-discovered socket path is refreshed after transport reset',
    async () => {
      let server1: Server | null = null
      let server2: Server | null = null
      let bridge: ReturnType<typeof createStdioRpcBridge> | null = null

      try {
        await mkdir(TEST_DIR, { recursive: true })
        await writeMockDiscovery(SOCKET_PATH, AUTH_TOKEN)
        // Set OPENPENCIL_MCP_SOCKET so the bridge's readDiscoveryFile() finds
        // the mock discovery file in our test directory.
        process.env.OPENPENCIL_MCP_SOCKET = SOCKET_PATH

        // Start server
        server1 = await createMockMcpServer(SOCKET_PATH, {
          authToken: AUTH_TOKEN,
          label: 'first'
        })

        // Create bridge WITHOUT explicit socketPath — forces auto-discovery
        // from the discovery file. hasExplicitSocketPath will be false.
        bridge = await createBridgeAndWaitForReady({
          // No socketPath — auto-discover from discovery file
          authToken: AUTH_TOKEN,
          reconnectDelayMs: 300
        })

        // Verify initial connection
        const result1 = await bridge.sendRpc({ command: 'test' })
        expect(result1).toEqual({ result: 'ok-first' })

        // Kill server
        await closeMockServer(server1, SOCKET_PATH)
        server1 = null

        // RPC should fail (transport error resets transportMode to null)
        await expect(bridge.sendRpc({ command: 'test' })).rejects.toThrow()

        // Restart server on the same socket path
        server2 = await createMockMcpServer(SOCKET_PATH, {
          authToken: AUTH_TOKEN,
          label: 'second'
        })

        // After transport reset, the bridge should clear the auto-discovered
        // resolvedSocketPath, re-read the discovery file, and reconnect.
        let reconnected = false
        for (let i = 0; i < 20; i++) {
          try {
            const result = await bridge.sendRpc({ command: 'test' })
            expect(result).toEqual({ result: 'ok-second' })
            reconnected = true
            break
          } catch {
            await new Promise<void>((r) => {
              setTimeout(r, 300)
            })
          }
        }
        expect(reconnected).toBe(true)
      } finally {
        bridge?.close()
        bridge = null
        await closeMockServer(server1, SOCKET_PATH)
        await closeMockServer(server2, SOCKET_PATH)
      }
    },
    15_000
  )

  test.skipIf(!isUnix)(
    'explicit socket path override is never overwritten by discovery',
    async () => {
      let server1: Server | null = null
      let server2: Server | null = null
      let bridge: ReturnType<typeof createStdioRpcBridge> | null = null

      try {
        await mkdir(TEST_DIR, { recursive: true })
        await writeMockDiscovery(SOCKET_PATH, AUTH_TOKEN)
        process.env.OPENPENCIL_MCP_SOCKET = SOCKET_PATH

        server1 = await createMockMcpServer(SOCKET_PATH, {
          authToken: AUTH_TOKEN,
          label: 'explicit1'
        })

        // Bridge WITH explicit socketPath — must never be overwritten by discovery
        bridge = await createBridgeAndWaitForReady({
          socketPath: SOCKET_PATH,
          authToken: AUTH_TOKEN,
          reconnectDelayMs: 300
        })

        const result1 = await bridge.sendRpc({ command: 'test' })
        expect(result1).toEqual({ result: 'ok-explicit1' })

        // Kill and restart on same socket
        await closeMockServer(server1, SOCKET_PATH)
        server1 = null
        server2 = await createMockMcpServer(SOCKET_PATH, {
          authToken: AUTH_TOKEN,
          label: 'explicit2'
        })

        // Reconnect — explicit path must be preserved
        let reconnected = false
        for (let i = 0; i < 20; i++) {
          try {
            const result = await bridge.sendRpc({ command: 'test' })
            expect(result).toEqual({ result: 'ok-explicit2' })
            reconnected = true
            break
          } catch {
            await new Promise<void>((r) => {
              setTimeout(r, 300)
            })
          }
        }
        expect(reconnected).toBe(true)
      } finally {
        bridge?.close()
        bridge = null
        await closeMockServer(server1, SOCKET_PATH)
        await closeMockServer(server2, SOCKET_PATH)
      }
    },
    15_000
  )

  test.skipIf(!isUnix)(
    'auto-discovered socket path picks up a CHANGED path from discovery after transport reset',
    async () => {
      let server1: Server | null = null
      let server2: Server | null = null
      let bridge: ReturnType<typeof createStdioRpcBridge> | null = null

      try {
        await mkdir(TEST_DIR, { recursive: true })
        await writeMockDiscovery(SOCKET_PATH, AUTH_TOKEN)
        process.env.OPENPENCIL_MCP_SOCKET = SOCKET_PATH

        // Start server on SOCKET_PATH
        server1 = await createMockMcpServer(SOCKET_PATH, {
          authToken: AUTH_TOKEN,
          label: 'old-socket'
        })

        // Create bridge WITHOUT explicit socketPath — auto-discovers
        bridge = await createBridgeAndWaitForReady({
          // No socketPath — auto-discover from discovery file
          authToken: AUTH_TOKEN,
          reconnectDelayMs: 300
        })

        // Verify initial connection to old socket
        const result1 = await bridge.sendRpc({ command: 'test' })
        expect(result1).toEqual({ result: 'ok-old-socket' })

        // Kill server on old socket
        await closeMockServer(server1, SOCKET_PATH)
        server1 = null

        // RPC should fail (triggers transportMode reset + clears resolvedSocketPath)
        await expect(bridge.sendRpc({ command: 'test' })).rejects.toThrow()

        // Simulate server restart on a NEW socket path:
        // 1. Update the discovery file to point to the new socket
        // 2. Start a new server on the new socket
        await writeMockDiscovery(SOCKET_PATH_2, AUTH_TOKEN)
        server2 = await createMockMcpServer(SOCKET_PATH_2, {
          authToken: AUTH_TOKEN,
          label: 'new-socket'
        })

        // The bridge must reconnect to the NEW socket path by re-reading
        // the updated discovery file. Without the fix (clearing
        // resolvedSocketPath on transport reset), the bridge would keep
        // trying the old SOCKET_PATH forever.
        let reconnected = false
        for (let i = 0; i < 20; i++) {
          try {
            const result = await bridge.sendRpc({ command: 'test' })
            expect(result).toEqual({ result: 'ok-new-socket' })
            reconnected = true
            break
          } catch {
            await new Promise<void>((r) => {
              setTimeout(r, 300)
            })
          }
        }
        expect(reconnected).toBe(true)
      } finally {
        bridge?.close()
        bridge = null
        await closeMockServer(server1, SOCKET_PATH)
        await closeMockServer(server2, SOCKET_PATH_2)
      }
    },
    15_000
  )
})
