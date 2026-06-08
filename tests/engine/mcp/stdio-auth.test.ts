import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile, unlink } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createStdioRpcBridge } from '#mcp/stdio-bridge'

const TEST_DIR = join(tmpdir(), `openpencil-test-stdio-auth-${process.pid}`)
const TEST_SOCKET = join(TEST_DIR, 'mcp-test.sock')
const AUTH_TOKEN = 'test-auto-token'

/**
 * Writes a mock discovery file at the location the bridge expects
 * (determined by OPENPENCIL_MCP_SOCKET env var).
 */
async function writeMockDiscovery(
  socketPath: string,
  authToken: string | null,
  httpPort: number = 0
): Promise<void> {
  await writeFile(
    join(TEST_DIR, 'mcp.json'),
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
 * Creates and starts a minimal HTTP server on a Unix socket that
 * mimics the MCP server's health and RPC endpoints.
 */
function createMockMcpServer(
  socketPath: string,
  options: {
    /** Auth token required for /rpc. null = no auth needed. */
    authToken?: string | null
    /** When true, the first /rpc request returns 401 regardless of auth. */
    firstRpcFailsWith401?: boolean
  } = {}
): Promise<Server> {
  const { authToken = null, firstRpcFailsWith401 = false } = options
  let rpcCount = 0

  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      // Health check — always succeeds
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok' }))
        return
      }

      // RPC endpoint
      if (req.url === '/rpc' && req.method === 'POST') {
        rpcCount++

        // Simulate first-call 401 for retry testing
        if (firstRpcFailsWith401 && rpcCount === 1) {
          res.writeHead(401)
          res.end(JSON.stringify({ error: 'Unauthorized' }))
          return
        }

        // Check auth
        const auth = req.headers.authorization
        if (authToken && auth !== `Bearer ${authToken}`) {
          res.writeHead(401)
          res.end(JSON.stringify({ error: 'bad auth' }))
          return
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ result: `ok-${rpcCount}` }))
        return
      }

      res.writeHead(404)
      res.end(JSON.stringify({ error: 'not found' }))
    })

    server.listen(socketPath, () => resolve(server))
  })
}

/**
 * Creates a stdio bridge and returns a Promise that resolves with the
 * bridge once its onReady callback fires (meaning health check passed
 * and ready=true). Rejects with a timeout if the bridge never becomes
 * ready.
 */
async function createBridgeAndWaitForReady(
  options: Parameters<typeof createStdioRpcBridge>[0]
): Promise<ReturnType<typeof createStdioRpcBridge>> {
  const { onReady: _ignored, ...rest } = options
  const TIMEOUT_MS = 5_000

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Bridge never became ready'))
    }, TIMEOUT_MS)

    const bridge = createStdioRpcBridge({
      ...rest,
      onReady: () => {
        clearTimeout(timer)
        resolve(bridge)
      }
    })
  })
}

describe('Fix 4 - Auth token auto-discovery and transparent retry', () => {
  let httpServer: Server | null = null
  const origSocketEnv = process.env.OPENPENCIL_MCP_SOCKET

  afterEach(async () => {
    if (httpServer) {
      httpServer.close()
      httpServer = null
    }
    if (origSocketEnv === undefined) {
      delete process.env.OPENPENCIL_MCP_SOCKET
    } else {
      process.env.OPENPENCIL_MCP_SOCKET = origSocketEnv
    }
    try {
      if (existsSync(TEST_SOCKET)) await unlink(TEST_SOCKET)
    } catch {
      void 0 // best-effort cleanup
    }
    try {
      const discoveryPath = join(TEST_DIR, 'mcp.json')
      if (existsSync(discoveryPath)) await unlink(discoveryPath)
    } catch {
      void 0 // best-effort cleanup
    }
    await rm(TEST_DIR, { recursive: true, force: true })
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100)
    })
  })

  test('auto-discovers auth token from discovery file', async () => {
    await mkdir(TEST_DIR, { recursive: true })

    // Set up infrastructure BEFORE creating the bridge, so its async
    // connect() succeeds on the first attempt.
    await writeMockDiscovery(TEST_SOCKET, AUTH_TOKEN)
    process.env.OPENPENCIL_MCP_SOCKET = TEST_SOCKET
    httpServer = await createMockMcpServer(TEST_SOCKET, { authToken: AUTH_TOKEN })

    // Bridge without explicit authToken — should auto-discover
    const bridge = await createBridgeAndWaitForReady({
      socketPath: TEST_SOCKET
    })

    const result = await bridge.sendRpc({ command: 'test' })
    expect(result).toEqual({ result: 'ok-1' })
  }, 10_000)

  test('401 with auto-discovered token retries transparently', async () => {
    await mkdir(TEST_DIR, { recursive: true })
    await writeMockDiscovery(TEST_SOCKET, AUTH_TOKEN)
    process.env.OPENPENCIL_MCP_SOCKET = TEST_SOCKET
    httpServer = await createMockMcpServer(TEST_SOCKET, {
      authToken: AUTH_TOKEN,
      firstRpcFailsWith401: true
    })

    const bridge = await createBridgeAndWaitForReady({
      socketPath: TEST_SOCKET
      // No authToken — auto-discovered
    })

    // The bridge is ready. sendRpc hits the server:
    //   Attempt 1 → 401 → bridge re-reads discovery, retries
    //   Attempt 2 → 200 with ok-2 (second call to /rpc)
    const result = await bridge.sendRpc({ command: 'test' })
    expect(result).toEqual({ result: 'ok-2' })
  }, 10_000)

  test('401 with explicit auth token surfaces error immediately (no retry)', async () => {
    await mkdir(TEST_DIR, { recursive: true })
    await writeMockDiscovery(TEST_SOCKET, AUTH_TOKEN)
    process.env.OPENPENCIL_MCP_SOCKET = TEST_SOCKET
    httpServer = await createMockMcpServer(TEST_SOCKET, { authToken: AUTH_TOKEN })

    // Bridge has EXPLICIT wrong token — 401 must surface immediately
    const bridge = await createBridgeAndWaitForReady({
      socketPath: TEST_SOCKET,
      authToken: 'wrong-token',
      reconnectDelayMs: 500
    })

    await expect(bridge.sendRpc({ command: 'test' })).rejects.toThrow(
      'Unauthorized: check OPENPENCIL_MCP_AUTH_TOKEN'
    )
  }, 10_000)

  test('explicit auth token is NOT overridden by discovery file', async () => {
    await mkdir(TEST_DIR, { recursive: true })
    await writeMockDiscovery(TEST_SOCKET, 'discovery-token-unused')
    process.env.OPENPENCIL_MCP_SOCKET = TEST_SOCKET
    httpServer = await createMockMcpServer(TEST_SOCKET, { authToken: 'explicit-token' })

    const bridge = await createBridgeAndWaitForReady({
      socketPath: TEST_SOCKET,
      authToken: 'explicit-token',
      reconnectDelayMs: 500
    })

    const result = await bridge.sendRpc({ command: 'test' })
    expect(result).toEqual({ result: 'ok-1' })
  }, 10_000)
})
