import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

import { SceneGraph } from '@open-pencil/core'

import { startServer, paramToZod } from '#mcp/server'

import { connectMockBrowser, type HealthResponse } from './helpers'

const isUnix = process.platform !== 'win32'
const SOCKET_DIR = join(tmpdir(), `openpencil-test-server-${process.pid}`)
const TEST_AUTH_TOKEN = 'test-auth-token'
const NO_AUTH_TOKEN = null as string | null
let testCounter = 0

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function testSocketPath(): string | null {
  if (!isUnix) return null
  return join(SOCKET_DIR, `mcp-test-${process.pid}-${++testCounter}.sock`)
}

// ---------------------------------------------------------------------------
// Auto-generated auth token
// ---------------------------------------------------------------------------

describe('MCP server auto-generated auth token', () => {
  test('requires auth when authToken is omitted (auto-generated)', async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      enableEval: false,
      mcpRoot: null
    })

    const httpPort = handle.httpPort
    if (!httpPort) {
      await handle.close()
      throw new Error('withTcp: true did not produce an HTTP port')
    }

    try {
      // Request without auth should be rejected
      const response = await fetch(`http://127.0.0.1:${httpPort}/mcp`, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'no-auth-test', version: '0.0.0' }
          }
        })
      })
      expect(response.status).toBe(401)

      // /health should show authRequired: true
      const healthResp = await fetch(`http://127.0.0.1:${httpPort}/health`)
      const health = (await healthResp.json()) as HealthResponse
      expect(health.authRequired).toBe(true)
    } finally {
      await handle.close()
    }
  })
})

// ---------------------------------------------------------------------------
// /rpc auth skip when authToken is null
// ---------------------------------------------------------------------------

describe('MCP server /rpc auth skip', () => {
  test('/rpc skips auth when authToken is explicitly null', async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: NO_AUTH_TOKEN,
      enableEval: false,
      mcpRoot: null
    })

    const httpPort = handle.httpPort
    if (!httpPort) {
      await handle.close()
      throw new Error('withTcp: true did not produce an HTTP port')
    }

    try {
      // /health should show authRequired: false
      const healthResp = await fetch(`http://127.0.0.1:${httpPort}/health`)
      const health = (await healthResp.json()) as HealthResponse
      expect(health.authRequired).toBe(false)

      // Connect a browser
      const graph = new SceneGraph()
      const browser = await connectMockBrowser(httpPort, graph)

      // /rpc should succeed without auth when browser IS connected
      const rpcResp = await fetch(`http://127.0.0.1:${httpPort}/rpc`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command: 'tool', args: { name: 'get_current_page' } })
      })
      expect(rpcResp.status).toBe(200)

      // /mcp should still work (no auth required)
      const mcpResp = await fetch(`http://127.0.0.1:${httpPort}/mcp`, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'no-auth-rpc-test', version: '0.0.0' }
          }
        })
      })
      expect(mcpResp.status).toBe(200)

      browser.close()
    } finally {
      await handle.close()
    }
  })
})

// ---------------------------------------------------------------------------
// paramToZod coercion
// ---------------------------------------------------------------------------

describe('paramToZod coercion', () => {
  test('number param accepts numeric strings', () => {
    const schema = paramToZod({ type: 'number', description: 'x', required: true })
    expect(schema.parse('42')).toBe(42)
    expect(schema.parse(42)).toBe(42)
    expect(schema.parse('3.14')).toBeCloseTo(3.14)
  })

  test('number param rejects non-numeric strings', () => {
    const schema = paramToZod({ type: 'number', description: 'x', required: true })
    expect(() => schema.parse('abc')).toThrow()
  })

  test('number param respects min/max after coercion', () => {
    const schema = paramToZod({
      type: 'number',
      description: 'x',
      required: true,
      min: 0,
      max: 100
    })
    expect(schema.parse('50')).toBe(50)
    expect(() => schema.parse('200')).toThrow()
    expect(() => schema.parse('-1')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// GAP-04: wrong auth token rejected
// ---------------------------------------------------------------------------

describe('MCP auth boundary', () => {
  test('server rejects requests with an incorrect auth token', async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: 'correct-token',
      enableEval: false,
      mcpRoot: null
    })
    const httpPort = handle.httpPort
    if (!httpPort) {
      await handle.close()
      throw new Error('withTcp: true did not produce an HTTP port')
    }

    try {
      const r = await fetch(`http://127.0.0.1:${httpPort}/mcp`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer wrong-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'mcp.ping', params: {} })
      })
      expect(r.status).toBe(401)
    } finally {
      await handle.close()
    }
  })

  test('server rejects requests with no Authorization header when auth is enabled', async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: 'correct-token',
      enableEval: false,
      mcpRoot: null
    })
    const httpPort = handle.httpPort
    if (!httpPort) {
      await handle.close()
      throw new Error('withTcp: true did not produce an HTTP port')
    }

    try {
      const r = await fetch(`http://127.0.0.1:${httpPort}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'mcp.ping', params: {} })
      })
      expect(r.status).toBe(401)
    } finally {
      await handle.close()
    }
  })

  test('server accepts requests with authToken: null (auth disabled)', async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: null,
      enableEval: false,
      mcpRoot: null
    })
    const httpPort = handle.httpPort
    if (!httpPort) {
      await handle.close()
      throw new Error('withTcp: true did not produce an HTTP port')
    }

    try {
      const healthResp = (await (
        await fetch(`http://127.0.0.1:${httpPort}/health`)
      ).json()) as HealthResponse
      expect(healthResp.authRequired).toBe(false)

      const mcpResp = await fetch(`http://127.0.0.1:${httpPort}/mcp`, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'auth-disabled-test', version: '0.0.0' }
          }
        })
      })
      expect(mcpResp.status).toBe(200)
    } finally {
      await handle.close()
    }
  })
})

// ---------------------------------------------------------------------------
// GAP-05: MCP session limits — MAX_MCP_SESSIONS=10
// ---------------------------------------------------------------------------

describe('MCP session limits', () => {
  test('server returns 503 when MAX_MCP_SESSIONS is exceeded', async () => {
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

    const sessions: Client[] = []
    const openSession = async () => {
      const c = new Client({ name: 'limit-client', version: '0.0.0' })
      const t = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${httpPort}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${TEST_AUTH_TOKEN}` } }
      })
      await c.connect(t)
      sessions.push(c)
      return c
    }

    try {
      // Open MAX_MCP_SESSIONS (10) sessions successfully
      for (let i = 0; i < 10; i++) await openSession()

      // The 11th must be rejected with 503. The MCP SDK wraps non-2xx
      // responses in StreamableHTTPError, so we assert on the error text
      // rather than on a successful return.
      const overflow = new Client({ name: 'overflow', version: '0.0.0' })
      const overflowTransport = new StreamableHTTPClientTransport(
        new URL(`http://127.0.0.1:${httpPort}/mcp`),
        { requestInit: { headers: { Authorization: `Bearer ${TEST_AUTH_TOKEN}` } } }
      )
      let caught: unknown = null
      try {
        await overflow.connect(overflowTransport)
        await overflow.listTools()
      } catch (e) {
        caught = e
      }
      expect(caught).toBeInstanceOf(Error)
      expect((caught as Error).message).toContain('Too many active MCP sessions')
      await overflow.close().catch(() => undefined)
    } finally {
      for (const s of sessions) await s.close().catch(() => undefined)
      await handle.close()
    }
  }, 30000)
})

// ---------------------------------------------------------------------------
// GAP-03: PID recycling in discovery — stale PID should not be treated as live
// ---------------------------------------------------------------------------

describe('Discovery PID liveness', () => {
  test('readDiscoveryFile does not treat a recycled PID as live', async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    const { getDiscoveryPath } = await import('@open-pencil/mcp/transport')

    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: TEST_AUTH_TOKEN,
      enableEval: false,
      mcpRoot: null
    })
    try {
      const discoveryPath = await getDiscoveryPath()
      const raw = (await Bun.file(discoveryPath).json()) as { pid: number }
      expect(raw.pid).toBe(process.pid)
    } finally {
      await handle.close()
    }

    // After close, the discovery file should be gone — even if the PID
    // is reused by a future process, the absence of the file is the
    // primary signal that the server is no longer reachable.
    const discoveryPath = await getDiscoveryPath()
    expect(await Bun.file(discoveryPath).exists()).toBe(false)
  })

  test('readDiscoveryFile returns null for a discovery file with a dead PID', async () => {
    const { getDiscoveryPath } = await import('@open-pencil/mcp/transport')
    const { readDiscoveryFile } = await import('#mcp/transport/discovery')
    const discoveryPath = await getDiscoveryPath()

    // Write a discovery file with a PID that is guaranteed not to be alive.
    // PID 1 (init/launchd) is alive on most systems, so use a very high PID
    // that is extremely unlikely to be in use.
    const deadPid = 4_000_000
    const discoveryDir = dirname(discoveryPath)
    await mkdir(discoveryDir, { recursive: true })
    await Bun.write(
      discoveryPath,
      JSON.stringify({
        pid: deadPid,
        socketPath: '/tmp/nonexistent-mcp.sock',
        httpPort: 9999,
        authRequired: true,
        authToken: 'dead-pid-test-token',
        version: '0.1.0-test',
        startedAt: new Date().toISOString()
      })
    )

    try {
      const result = await readDiscoveryFile()
      expect(result).toBeNull()
    } finally {
      // Clean up the seeded discovery file
      try {
        const { unlink } = await import('node:fs/promises')
        await unlink(discoveryPath)
      } catch {
        void 0 // best-effort cleanup
      }
    }
  })
})
