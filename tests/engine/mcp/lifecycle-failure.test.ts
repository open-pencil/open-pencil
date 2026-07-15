import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { startServer, type ServerHandle } from '#mcp/server'

import { socketRequest, type HealthResponse } from './helpers'

const isUnix = process.platform !== 'win32'
const SOCKET_DIR = join(tmpdir(), `openpencil-test-lifecycle-${process.pid}`)
const TEST_AUTH_TOKEN = 'test-auth-token'
let testCounter = 0

function testSocketPath(): string | null {
  if (!isUnix) return null
  return join(SOCKET_DIR, `mcp-test-${process.pid}-${++testCounter}.sock`)
}

// ---------------------------------------------------------------------------
// Listen failure cleanup tests (Reviews 02, 03)
// ---------------------------------------------------------------------------

describe('MCP lifecycle failure cleanup', () => {
  beforeAll(async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
  })

  afterAll(async () => {
    if (isUnix) await rm(SOCKET_DIR, { recursive: true, force: true })
  })

  test('TCP listen failure rejects and does not leak the server', async () => {
    // Start the first server on an ephemeral port
    const handle1 = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: TEST_AUTH_TOKEN,
      enableEval: false,
      mcpRoot: null
    })
    const occupiedPort = handle1.httpPort
    expect(occupiedPort).toBeGreaterThan(0)

    try {
      // Try to start a second server on the same TCP port — must fail
      await expect(
        startServer({
          httpPort: occupiedPort,
          withTcp: true,
          socketPath: testSocketPath(),
          authToken: 'different-token',
          enableEval: false,
          mcpRoot: null
        })
      ).rejects.toThrow()

      // The first server must still be healthy — the failed second start
      // must not have corrupted the first server's listener.
      const health = await fetch(`http://127.0.0.1:${occupiedPort}/health`)
      expect(health.status).toBe(200)
      const data = (await health.json()) as HealthResponse
      expect(data.status).toBe('no_app')
    } finally {
      await handle1.close()
    }
  })

  if (isUnix) {
    test('Unix socket listen failure rejects and does not leak the server', async () => {
      const socketPath = testSocketPath()
      expect(socketPath).toBeTruthy()
      if (!socketPath) return

      // Start the first server on the socket path
      const handle1 = await startServer({
        httpPort: 0,
        withTcp: false,
        socketPath,
        authToken: TEST_AUTH_TOKEN,
        enableEval: false,
        mcpRoot: null
      })
      expect(handle1.socketPath).toBe(socketPath)

      try {
        // Try to start a second server on the same socket path — must fail.
        // removeStaleSocket detects the first server is alive and leaves
        // the socket file in place, so listen() fails with EADDRINUSE.
        await expect(
          startServer({
            httpPort: 0,
            withTcp: false,
            socketPath,
            authToken: 'different-token',
            enableEval: false,
            mcpRoot: null
          })
        ).rejects.toThrow()

        // The first server must still be healthy — verify via Unix socket
        // since withTcp:false means no HTTP port is available.
        const health = await socketRequest(socketPath, 'GET', '/health')
        expect(health.status).toBe(200)
      } finally {
        await handle1.close()
      }
    })
  }
})

// ---------------------------------------------------------------------------
// DELETE session cleanup tests (Review 03)
// ---------------------------------------------------------------------------

describe('MCP DELETE session cleanup', () => {
  let handle: ServerHandle
  let httpPort: number

  beforeAll(async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: TEST_AUTH_TOKEN,
      enableEval: false,
      mcpRoot: null
    })
    httpPort = handle.httpPort
    if (!httpPort) {
      await handle.close()
      throw new Error('TCP listener not started')
    }
  })

  afterAll(async () => {
    await handle.close()
  })

  test('DELETE removes the session so subsequent DELETE returns 404', async () => {
    // Initialize a session via POST /mcp. Use fetch (not tcpRequest) because
    // we need the mcp-session-id response header, which tcpRequest doesn't expose.
    const initFetch = await fetch(`http://127.0.0.1:${httpPort}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${TEST_AUTH_TOKEN}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'delete-test', version: '0.0.0' }
        }
      })
    })
    expect(initFetch.status).toBe(200)
    const sessionId = initFetch.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()
    if (!sessionId) return

    // Send DELETE to terminate the session
    const deleteResp = await fetch(`http://127.0.0.1:${httpPort}/mcp`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${TEST_AUTH_TOKEN}`,
        'mcp-session-id': sessionId
      }
    })
    expect(deleteResp.status).toBe(200)

    // Send another DELETE with the same session ID — must return 404
    // because the session was deleted by the finally block
    const deleteResp2 = await fetch(`http://127.0.0.1:${httpPort}/mcp`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${TEST_AUTH_TOKEN}`,
        'mcp-session-id': sessionId
      }
    })
    expect(deleteResp2.status).toBe(404)
  })

  test('DELETE with invalid protocol version still cleans up the session', async () => {
    // Initialize a session
    const initFetch = await fetch(`http://127.0.0.1:${httpPort}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${TEST_AUTH_TOKEN}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'delete-test-3', version: '0.0.0' }
        }
      })
    })
    expect(initFetch.status).toBe(200)
    const sessionId = initFetch.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()
    if (!sessionId) return

    // Send DELETE with an invalid protocol version header.
    // The SDK's handleDeleteRequest calls validateProtocolVersion which
    // returns a 400 error response (does not throw). The try/finally
    // block must still delete the session.
    const deleteResp = await fetch(`http://127.0.0.1:${httpPort}/mcp`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${TEST_AUTH_TOKEN}`,
        'mcp-session-id': sessionId,
        'mcp-protocol-version': 'invalid-version-999'
      }
    })
    // The SDK returns 400 for invalid protocol version
    expect(deleteResp.status).toBe(400)

    // The session must still be deleted despite the error response.
    // Send another DELETE — must return 404.
    const deleteResp2 = await fetch(`http://127.0.0.1:${httpPort}/mcp`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${TEST_AUTH_TOKEN}`,
        'mcp-session-id': sessionId
      }
    })
    expect(deleteResp2.status).toBe(404)
  })
})
