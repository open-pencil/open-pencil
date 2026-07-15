import { describe, expect, it, test, beforeAll, afterAll } from 'bun:test'
import { stat, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { SceneGraph } from '@open-pencil/scene-graph'

import { startServer, type ServerHandle } from '#mcp/server'

import {
  connectMockBrowser,
  openWs,
  readNextResponse,
  readWsJson,
  socketRequest,
  tcpRequest,
  waitForBrowserRegistration,
  type HealthResponse,
  type MockBrowser
} from './helpers'

const isUnix = process.platform !== 'win32'
const SOCKET_DIR = join(tmpdir(), `openpencil-test-server-${process.pid}`)
const SOCKET_PATH = isUnix ? join(SOCKET_DIR, 'mcp.sock') : null
const TEST_AUTH_TOKEN = 'test-auth-token'
let testCounter = 0
let sharedPort = 0

function testSocketPath(): string | null {
  if (!isUnix) return null
  return join(SOCKET_DIR, `mcp-test-${process.pid}-${++testCounter}.sock`)
}

// ---------------------------------------------------------------------------
// Unified transport tests (socket + TCP)
// ---------------------------------------------------------------------------

describe('MCP server unified transport', () => {
  let handle: ServerHandle | null = null

  beforeAll(async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    try {
      handle = await startServer({
        httpPort: 0,
        withTcp: true,
        socketPath: SOCKET_PATH,
        authToken: 'test-token-123',
        enableEval: false,
        mcpRoot: null
      })
      sharedPort = handle.httpPort
    } catch (e) {
      await handle?.close().catch(() => undefined)
      throw e
    }
  })

  afterAll(async () => {
    await handle?.close()
    if (isUnix) await rm(SOCKET_DIR, { recursive: true, force: true })
  })

  describe('TCP HTTP endpoint', () => {
    it('responds to /health', async () => {
      const result = await tcpRequest(sharedPort, 'GET', '/health')
      expect(result.status).toBe(200)
      const health = result.data as HealthResponse
      expect(health.version).toBeTruthy()
      expect(health.status).toBe('no_app')
      expect(health.authRequired).toBe(true)
    })

    it('rejects /rpc without auth', async () => {
      const result = await tcpRequest(sharedPort, 'POST', '/rpc', { command: 'tool' })
      expect(result.status).toBe(401)
    })

    it('rejects /mcp without auth', async () => {
      const result = await tcpRequest(sharedPort, 'POST', '/mcp')
      expect(result.status).toBe(401)
    })

    it('accepts /mcp with auth token', async () => {
      const result = await tcpRequest(
        sharedPort,
        'POST',
        '/mcp',
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'smoke-test', version: '0.0.0' }
          }
        },
        {
          accept: 'application/json, text/event-stream',
          Authorization: 'Bearer test-token-123'
        }
      )
      expect(result.status).toBe(200)
    })
  })

  if (isUnix) {
    describe('Unix domain socket endpoint', () => {
      it('responds to /health via socket', async () => {
        if (!handle) throw new Error('Server handle not initialized')
        const socketPath = handle.socketPath
        expect(socketPath).toBeTruthy()
        if (!socketPath) throw new Error('socketPath is null')
        const result = await socketRequest(socketPath, 'GET', '/health')
        expect(result.status).toBe(200)
        const health = result.data as HealthResponse
        expect(health.version).toBeTruthy()
      })

      it('socket file has restrictive permissions', async () => {
        if (!handle) throw new Error('Server handle not initialized')
        const socketPath = handle.socketPath
        expect(socketPath).toBeTruthy()
        if (!socketPath) throw new Error('socketPath is null')
        const info = await stat(socketPath)
        const mode = info.mode & 0o777
        expect(mode).toBe(0o600)
      })
    })
  }

  describe('Discovery', () => {
    it('writes a discovery file matching the running server', async () => {
      const { getDiscoveryPath } = await import('#mcp/transport/paths')
      const discoveryPath = await getDiscoveryPath()
      const file = Bun.file(discoveryPath)
      expect(await file.exists()).toBe(true)
      const info = (await file.json()) as {
        pid: number
        httpPort: number
        socketPath: string | null
        version: string
        authToken: string | null
      }
      expect(info.pid).toBe(process.pid)
      expect(info.httpPort).toBe(handle?.httpPort ?? 0)
      expect(info.socketPath).toBe(handle?.socketPath ?? null)
      expect(info.version).toBeTruthy()
      expect(info.authToken).toBe('test-token-123')
    })
  })
})

// ---------------------------------------------------------------------------
// Streamable HTTP transport
// ---------------------------------------------------------------------------

describe('MCP Streamable HTTP transport', () => {
  test('returns JSON responses for request/response calls', async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: TEST_AUTH_TOKEN,
      enableEval: false,
      mcpRoot: null
    })

    const httpPort = handle.httpPort
    if (!httpPort) {
      await handle.close()
      throw new Error('withTcp: true did not produce an HTTP port')
    }

    try {
      const response = await fetch(`http://127.0.0.1:${httpPort}/mcp`, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
          Authorization: `Bearer ${TEST_AUTH_TOKEN}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'raw-test', version: '0.0.0' }
          }
        })
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/json')
      expect(response.headers.get('content-type')).not.toContain('text/event-stream')
    } finally {
      await handle.close()
    }
  })
})

// ---------------------------------------------------------------------------
// WebSocket stdio bridge routing
// ---------------------------------------------------------------------------

describe('MCP WebSocket stdio bridge routing', () => {
  test('forwards stdio client requests to the registered desktop app', async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    const authToken = 'bridge-test-token'
    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken,
      enableEval: false,
      mcpRoot: null
    })

    const httpPort = handle.httpPort
    if (!httpPort) {
      await handle.close()
      throw new Error('withTcp: true did not produce an HTTP port')
    }

    const graph = new SceneGraph()
    const browser = await connectMockBrowser(httpPort, graph, authToken)
    await waitForBrowserRegistration(httpPort)
    const clientWs = await openWs(`ws://127.0.0.1:${httpPort}`, authToken)

    try {
      const register = await readWsJson<{ type: string; token?: string | null }>(clientWs)
      expect(register.type).toBe('register')
      // Token is null in the prompt — the browser sends its known token
      // proactively, not from this prompt.
      expect(register.token).toBeNull()

      clientWs.send(
        JSON.stringify({
          type: 'request',
          id: 'stdio-1',
          command: 'tool',
          args: { name: 'get_current_page', args: {} }
        })
      )
      const response = await readNextResponse<{
        type: string
        id: string
        ok?: boolean
        result?: { name: string }
      }>(clientWs)

      expect(response.type).toBe('response')
      expect(response.id).toBe('stdio-1')
      expect(response.ok).toBe(true)
      expect(response.result?.name).toBe('Page 1')
      expect(browser.requests.at(-1)?.command).toBe('tool')
    } finally {
      clientWs.close()
      browser.close()
      await handle.close()
    }
  })

  test('returns a disconnected response after waiting when no app is registered', async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: 'bridge-test-token',
      enableEval: false,
      mcpRoot: null
    })

    const httpPort = handle.httpPort
    if (!httpPort) {
      await handle.close()
      throw new Error('withTcp: true did not produce an HTTP port')
    }

    const clientWs = await openWs(`ws://127.0.0.1:${httpPort}`, 'bridge-test-token')

    try {
      // Consume the initial register message sent on connection
      const register = await readWsJson<{ type: string; token?: string | null }>(clientWs)
      expect(register.type).toBe('register')

      clientWs.send(
        JSON.stringify({
          type: 'request',
          id: 'stdio-no-app',
          command: 'tool',
          args: { name: 'get_current_page', args: {} }
        })
      )
      const response = await readNextResponse<{
        type: string
        id: string
        ok?: boolean
        error?: string
      }>(clientWs, 15_000)

      expect(response.type).toBe('response')
      expect(response.id).toBe('stdio-no-app')
      expect(response.ok).toBe(false)
      expect(response.error).toContain('OpenPencil app is not connected')
    } finally {
      clientWs.close()
      await handle.close()
    }
  }, 20_000)

  test('notifies already-connected stdio clients when the desktop app registers later', async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    const authToken = 'bridge-test-token'
    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken,
      enableEval: false,
      mcpRoot: null
    })

    const httpPort = handle.httpPort
    if (!httpPort) {
      await handle.close()
      throw new Error('withTcp: true did not produce an HTTP port')
    }

    const clientWs = await openWs(`ws://127.0.0.1:${httpPort}`, authToken)
    const graph = new SceneGraph()
    let browser: MockBrowser | null = null

    try {
      // Read the initial register prompt sent on connection (before browser)
      const initialRegister = await readWsJson<{ type: string; token?: string | null }>(clientWs)
      expect(initialRegister.type).toBe('register')
      // Token is null — the browser app sends its token proactively
      expect(initialRegister.token).toBeNull()

      // Set up the broadcast listener BEFORE registering the browser,
      // otherwise the message can be lost (ws doesn't buffer messages).
      const broadcastPromise = readWsJson<{ type: string; token?: string | null }>(clientWs, 3_000)
      browser = await connectMockBrowser(httpPort, graph, authToken)
      // Read the broadcast register notification sent when browser connects
      const broadcastRegister = await broadcastPromise
      expect(broadcastRegister.type).toBe('register')
      expect(broadcastRegister.token).toBeNull()
    } finally {
      clientWs.close()
      browser?.close()
      await handle.close()
    }
  })

  test('pending request succeeds when browser connects during the wait', async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    const authToken = 'bridge-test-token'
    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken,
      enableEval: false,
      mcpRoot: null
    })

    const httpPort = handle.httpPort
    if (!httpPort) {
      await handle.close()
      throw new Error('withTcp: true did not produce an HTTP port')
    }

    // Connect a WebSocket client (NOT a browser — no register message yet)
    const clientWs = await openWs(`ws://127.0.0.1:${httpPort}`, authToken)

    try {
      // Read the initial register prompt
      const initReg = await readWsJson<{ type: string; token?: string | null }>(clientWs)
      expect(initReg.type).toBe('register')

      // Send a request BEFORE the browser connects
      const requestPromise = (async () => {
        clientWs.send(
          JSON.stringify({
            type: 'request',
            id: 'wait-test-1',
            command: 'tool',
            args: { name: 'get_current_page', args: {} }
          })
        )
        return readNextResponse<{
          type: string
          id: string
          ok?: boolean
          result?: { name: string }
        }>(clientWs, 15_000)
      })()

      // Wait briefly, then connect the browser
      await new Promise<void>((r) => {
        setTimeout(r, 500)
      })
      const graph = new SceneGraph()
      const browser = await connectMockBrowser(httpPort, graph, authToken)

      const response = await requestPromise
      expect(response.type).toBe('response')
      expect(response.id).toBe('wait-test-1')
      expect(response.ok).toBe(true)
      expect(response.result?.name).toBe('Page 1')

      browser.close()
    } finally {
      clientWs.close()
      await handle.close()
    }
  }, 20_000)

  test('routes new requests to the latest registered desktop app after reconnect', async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    const authToken = 'bridge-test-token'
    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken,
      enableEval: false,
      mcpRoot: null
    })

    const httpPort = handle.httpPort
    if (!httpPort) {
      await handle.close()
      throw new Error('withTcp: true did not produce an HTTP port')
    }

    const waitForHealth = async (
      predicate: (status: string) => boolean,
      timeoutMs = 2000
    ): Promise<{ status: string }> => {
      const sleep = (ms: number) =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, ms)
        })
      const start = Date.now()
      let last: { status: string } = { status: 'unknown' }
      while (Date.now() - start < timeoutMs) {
        const r = await fetch(`http://127.0.0.1:${httpPort}/health`)
        last = (await r.json()) as { status: string }
        if (predicate(last.status)) return last
        await sleep(25)
      }
      throw new Error(
        `Health predicate never matched within ${timeoutMs}ms (last status: ${last.status})`
      )
    }

    // Connect the first browser, then close it to simulate a disconnect.
    const firstGraph = new SceneGraph()
    const firstBrowser = await connectMockBrowser(httpPort, firstGraph, authToken)
    // Confirm the first browser is registered.
    await waitForHealth((s) => s === 'ok')
    firstBrowser.close()

    // Wait for the server to detect the disconnect (status flips back to 'no_app')
    await waitForHealth((s) => s === 'no_app')

    // Connect the second browser
    const secondGraph = new SceneGraph()
    const secondBrowser = await connectMockBrowser(httpPort, secondGraph, authToken)

    // Wait for the second browser to register
    await waitForHealth((s) => s === 'ok')

    const clientWs = await openWs(`ws://127.0.0.1:${httpPort}`, authToken)

    try {
      // Read the initial register message (token is null for security —
      // the browser app sends the token proactively, not from this prompt)
      const initReg = await readWsJson<{ type: string; token?: string | null }>(clientWs)
      expect(initReg.type).toBe('register')
      expect(initReg.token).toBeNull()

      clientWs.send(
        JSON.stringify({
          type: 'request',
          id: 'stdio-after-reconnect',
          command: 'tool',
          args: { name: 'get_current_page', args: {} }
        })
      )
      const response = await readNextResponse<{ type: string; id: string; ok?: boolean }>(clientWs)

      expect(response.type).toBe('response')
      expect(response.id).toBe('stdio-after-reconnect')
      expect(response.ok).toBe(true)
      expect(secondBrowser.requests.at(-1)?.command).toBe('tool')
    } finally {
      clientWs.close()
      secondBrowser.close()
      await handle.close()
    }
  }, 10000)
})
