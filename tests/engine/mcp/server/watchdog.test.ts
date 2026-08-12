import { afterEach, describe, expect, test } from 'bun:test'
import { access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { SceneGraph } from '@open-pencil/scene-graph'

import { startServer, type ServerHandle } from '#mcp/server'
import { getDiscoveryPath } from '#mcp/transport/paths'

import { connectMockBrowser, type HealthResponse } from '#tests/helpers/mcp/server'

// Issue #488: an MCP server spawned by the app but never claimed by one
// (renderer crash, forced reload) used to squat its port forever with a
// stale discovery file. appAttachTimeoutMs closes such a server automatically.

const TEST_AUTH_TOKEN = 'test-auth-token'
let testCounter = 0

function testSocketPath(): string | null {
  if (process.platform === 'win32') return null
  return join(tmpdir(), `openpencil-test-watchdog-${process.pid}-${++testCounter}.sock`)
}

async function fileExists(path: string): Promise<boolean> {
  return access(path)
    .then(() => true)
    .catch(() => false)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function waitForHealthStatus(port: number, status: HealthResponse['status']): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const response = await fetch(`http://127.0.0.1:${port}/health`)
    const health = (await response.json()) as HealthResponse
    if (health.status === status) return
    await sleep(5)
  }
  throw new Error(`Health endpoint did not report ${status}`)
}

describe('MCP app-attach watchdog', () => {
  let handle: ServerHandle | null = null

  afterEach(async () => {
    await handle?.close().catch(() => undefined)
    handle = null
  })

  test('closes the server and removes its discovery file when no app registers in time', async () => {
    handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: TEST_AUTH_TOKEN,
      enableEval: false,
      mcpRoot: null,
      appAttachTimeoutMs: 50
    })
    const port = handle.httpPort
    expect(port).toBeGreaterThan(0)

    const discoveryPath = await getDiscoveryPath()
    expect(await fileExists(discoveryPath)).toBe(true)

    // Nobody ever registers as the app. Wait past the watchdog timeout.
    await sleep(300)

    await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow()
    expect(await fileExists(discoveryPath)).toBe(false)

    handle = null // already closed by the watchdog — afterEach must not double-close
  })

  test('keeps a registered app alive past the initial grace period', async () => {
    handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: TEST_AUTH_TOKEN,
      enableEval: false,
      mcpRoot: null,
      appAttachTimeoutMs: 100
    })
    const port = handle.httpPort

    const browser = await connectMockBrowser(port, new SceneGraph(), TEST_AUTH_TOKEN)
    try {
      // Wait past the watchdog timeout — a registered app must not be evicted.
      await sleep(300)

      const health = await fetch(`http://127.0.0.1:${port}/health`)
      expect(health.status).toBe(200)
      const data = (await health.json()) as HealthResponse
      expect(data.status).toBe('ok')
    } finally {
      browser.close()
    }
  })

  test('closes the server after a registered app disconnects for the grace period', async () => {
    handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: TEST_AUTH_TOKEN,
      enableEval: false,
      mcpRoot: null,
      appAttachTimeoutMs: 75
    })
    const port = handle.httpPort

    const browser = await connectMockBrowser(port, new SceneGraph(), TEST_AUTH_TOKEN)
    browser.close()
    await sleep(300)

    await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow()
    handle = null
  })

  test('cancels pending shutdown when the app reconnects', async () => {
    handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: TEST_AUTH_TOKEN,
      enableEval: false,
      mcpRoot: null,
      appAttachTimeoutMs: 150
    })
    const port = handle.httpPort

    const firstBrowser = await connectMockBrowser(port, new SceneGraph(), TEST_AUTH_TOKEN)
    firstBrowser.close()
    await waitForHealthStatus(port, 'no_app')
    const secondBrowser = await connectMockBrowser(port, new SceneGraph(), TEST_AUTH_TOKEN)
    try {
      await sleep(250)
      const health = await fetch(`http://127.0.0.1:${port}/health`)
      expect(health.status).toBe(200)
      const data = (await health.json()) as HealthResponse
      expect(data.status).toBe('ok')
    } finally {
      secondBrowser.close()
    }
  })

  test('rejects timer values that cannot be represented safely', async () => {
    await expect(
      startServer({ appAttachTimeoutMs: 2_147_483_648, socketPath: testSocketPath() })
    ).rejects.toThrow('appAttachTimeoutMs must be in the range 0–2147483647')
    await expect(
      startServer({ appAttachTimeoutMs: Number.POSITIVE_INFINITY, socketPath: testSocketPath() })
    ).rejects.toThrow('appAttachTimeoutMs must be a safe integer')
  })
})
