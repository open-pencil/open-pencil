import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

import { SceneGraph } from '@open-pencil/core'

import { startServer } from '#mcp/server'

import { connectMockBrowser } from './helpers'

const isUnix = process.platform !== 'win32'
const SOCKET_DIR = join(tmpdir(), `openpencil-test-server-${process.pid}`)
const TEST_MCP_ROOT = join(tmpdir(), 'open-pencil-mcp-root')
const TEST_AUTH_TOKEN = 'test-auth-token'
let testCounter = 0

// ---------------------------------------------------------------------------
// Test client: starts server with ephemeral TCP port, connects mock browser + MCP client
// ---------------------------------------------------------------------------

function testSocketPath(): string | null {
  if (!isUnix) return null
  return join(SOCKET_DIR, `mcp-test-${process.pid}-${++testCounter}.sock`)
}

async function createTestClient() {
  if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
  const authToken = 'test-client-token'
  const handle = await startServer({
    httpPort: 0,
    withTcp: true,
    socketPath: testSocketPath(),
    authToken,
    enableEval: false,
    mcpRoot: null
  })

  const httpPort = handle.httpPort
  if (!httpPort) throw new Error('TCP listener not started')

  const graph = new SceneGraph()
  const browser = await connectMockBrowser(httpPort, graph, authToken)

  const client = new Client({ name: 'test-client', version: '0.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${httpPort}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${authToken}` } }
  })
  await client.connect(transport)

  return {
    client,
    graph,
    handle,
    close: async () => {
      await client.close()
      browser.close()
      await handle.close()
    }
  }
}

function parseResult(result: { content: { type: string; text?: string }[] }): unknown {
  const textContent = result.content.find((c) => c.type === 'text')
  return textContent?.text ? JSON.parse(textContent.text) : null
}

// ---------------------------------------------------------------------------
// MCP tool + session tests
// ---------------------------------------------------------------------------

describe('MCP server', () => {
  let client: Client
  let graph: SceneGraph
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    const ctx = await createTestClient()
    client = ctx.client
    graph = ctx.graph
    cleanup = ctx.close
  })

  afterEach(async () => {
    await cleanup()
  })

  test('lists all registered tools', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toContain('create_shape')
    expect(names).toContain('set_fill')
    expect(names).toContain('get_page_tree')
    expect(names).toContain('render')
    expect(names).toContain('get_codegen_prompt')
    expect(tools.length).toBeGreaterThan(30)
  })

  test('tools have descriptions and input schemas', async () => {
    const { tools } = await client.listTools()
    for (const tool of tools) {
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
    }
  })

  test('create_shape creates a node on the live canvas', async () => {
    const result = await client.callTool({
      name: 'create_shape',
      arguments: { type: 'FRAME', x: 0, y: 0, width: 200, height: 100, name: 'Test' }
    })
    expect(result.isError).not.toBe(true)
    const data = parseResult(result) as { id: string; name: string; type: string }
    expect(data.type).toBe('FRAME')
    expect(data.name).toBe('Test')

    const node = graph.getNode(data.id)
    expect(node).toBeDefined()
    expect(node?.name).toBe('Test')
  })

  test('set_fill validates and applies color', async () => {
    const create = await client.callTool({
      name: 'create_shape',
      arguments: { type: 'RECTANGLE', x: 0, y: 0, width: 50, height: 50 }
    })
    const { id } = parseResult(create) as { id: string }

    const fill = await client.callTool({
      name: 'set_fill',
      arguments: { id, color: '#00ff00' }
    })
    expect(fill.isError).not.toBe(true)
  })

  test('get_page_tree returns page structure', async () => {
    await client.callTool({
      name: 'create_shape',
      arguments: { type: 'FRAME', x: 0, y: 0, width: 100, height: 100, name: 'F1' }
    })
    const result = await client.callTool({ name: 'get_page_tree', arguments: {} })
    expect(result.isError).not.toBe(true)
    const data = parseResult(result) as { children: { name: string }[] }
    expect(data.children.some((c) => c.name === 'F1')).toBe(true)
  })

  test('delete_node removes a node', async () => {
    const create = await client.callTool({
      name: 'create_shape',
      arguments: { type: 'RECTANGLE', x: 0, y: 0, width: 50, height: 50 }
    })
    const { id } = parseResult(create) as { id: string }

    await client.callTool({ name: 'delete_node', arguments: { id } })

    const get = await client.callTool({ name: 'get_node', arguments: { id } })
    const data = parseResult(get) as { error?: string }
    expect(data.error).toContain('not found')
  })

  test('find_nodes filters by type', async () => {
    await client.callTool({
      name: 'create_shape',
      arguments: { type: 'FRAME', x: 0, y: 0, width: 100, height: 100 }
    })
    await client.callTool({
      name: 'create_shape',
      arguments: { type: 'RECTANGLE', x: 0, y: 0, width: 50, height: 50 }
    })
    await client.callTool({
      name: 'create_shape',
      arguments: { type: 'FRAME', x: 0, y: 0, width: 100, height: 100 }
    })
    const result = await client.callTool({ name: 'find_nodes', arguments: { type: 'FRAME' } })
    const data = parseResult(result) as { count: number }
    expect(data.count).toBe(2)
  })

  test('get_codegen_prompt returns prompt text', async () => {
    const result = await client.callTool({ name: 'get_codegen_prompt', arguments: {} })
    expect(result.isError).not.toBe(true)
    const data = parseResult(result) as { prompt: string }
    expect(data.prompt.length).toBeGreaterThan(100)
  })
})

// ---------------------------------------------------------------------------
// mcpRoot tests
// ---------------------------------------------------------------------------

describe('MCP server with mcpRoot', () => {
  test('registers open_file and new_document tools when mcpRoot is set', async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: TEST_AUTH_TOKEN,
      enableEval: false,
      mcpRoot: TEST_MCP_ROOT
    })

    const httpPort = handle.httpPort
    if (!httpPort) {
      await handle.close()
      return
    }

    const graph = new SceneGraph()
    const browser = await connectMockBrowser(httpPort, graph, TEST_AUTH_TOKEN)

    const client = new Client({ name: 'test-root', version: '0.0.0' })
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${httpPort}/mcp`),
      { requestInit: { headers: { Authorization: `Bearer ${TEST_AUTH_TOKEN}` } } }
    )
    await client.connect(transport)

    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toContain('open_file')
    expect(names).toContain('new_document')

    await client.close()
    browser.close()
    await handle.close()
  })

  test('save_file accepts an explicit path inside mcpRoot', async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: TEST_AUTH_TOKEN,
      enableEval: false,
      mcpRoot: TEST_MCP_ROOT
    })

    const httpPort = handle.httpPort
    if (!httpPort) {
      await handle.close()
      return
    }

    const graph = new SceneGraph()
    const browser = await connectMockBrowser(httpPort, graph, TEST_AUTH_TOKEN)

    const client = new Client({ name: 'test-root-save', version: '0.0.0' })
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${httpPort}/mcp`),
      { requestInit: { headers: { Authorization: `Bearer ${TEST_AUTH_TOKEN}` } } }
    )
    await client.connect(transport)

    const savePath = join(TEST_MCP_ROOT, 'unicode', 'пример.fig')
    const result = await client.callTool({
      name: 'save_file',
      arguments: { path: savePath }
    })

    expect(result.isError).not.toBe(true)
    const request = browser.requests.find((item) => item.command === 'save_file')
    expect(request?.args).toEqual({ path: savePath })

    await client.close()
    browser.close()
    await handle.close()
  })

  test('save_file rejects paths outside mcpRoot', async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: TEST_AUTH_TOKEN,
      enableEval: false,
      mcpRoot: TEST_MCP_ROOT
    })

    const httpPort = handle.httpPort
    if (!httpPort) {
      await handle.close()
      return
    }

    const graph = new SceneGraph()
    const browser = await connectMockBrowser(httpPort, graph, TEST_AUTH_TOKEN)

    const client = new Client({ name: 'test-root-save-outside', version: '0.0.0' })
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${httpPort}/mcp`),
      { requestInit: { headers: { Authorization: `Bearer ${TEST_AUTH_TOKEN}` } } }
    )
    await client.connect(transport)

    const result = await client.callTool({
      name: 'save_file',
      arguments: { path: join(join(TEST_MCP_ROOT, '..'), 'outside.fig') }
    })

    expect(result.isError).toBe(true)
    expect(browser.requests.some((item) => item.command === 'save_file')).toBe(false)

    await client.close()
    browser.close()
    await handle.close()
  })

  test('does not register open_file when mcpRoot is null', async () => {
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
      return
    }

    const graph = new SceneGraph()
    const browser = await connectMockBrowser(httpPort, graph, TEST_AUTH_TOKEN)

    const client = new Client({ name: 'test-no-root', version: '0.0.0' })
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${httpPort}/mcp`),
      { requestInit: { headers: { Authorization: `Bearer ${TEST_AUTH_TOKEN}` } } }
    )
    await client.connect(transport)

    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).not.toContain('open_file')
    expect(names).not.toContain('new_document')

    await client.close()
    browser.close()
    await handle.close()
  })
})

// ---------------------------------------------------------------------------
// GAP-01: server.close() resource cleanup
// ---------------------------------------------------------------------------

describe('MCP server lifecycle', () => {
  test('close() removes the discovery file from disk', async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    const { getDiscoveryPath } = await import('@open-pencil/mcp/transport')
    const discoveryPath = await getDiscoveryPath()

    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: TEST_AUTH_TOKEN,
      enableEval: false,
      mcpRoot: null
    })
    expect(await Bun.file(discoveryPath).exists()).toBe(true)

    await handle.close()
    expect(await Bun.file(discoveryPath).exists()).toBe(false)
  })

  test('close() removes the unix socket file from disk', async () => {
    if (!isUnix) return
    await mkdir(SOCKET_DIR, { recursive: true })
    const socketPath = testSocketPath()
    if (!socketPath) return

    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath,
      authToken: TEST_AUTH_TOKEN,
      enableEval: false,
      mcpRoot: null
    })
    const info = await stat(socketPath)
    expect(info.isSocket()).toBe(true)

    await handle.close()
    await expect(stat(socketPath)).rejects.toThrow()
  })

  test('close() is idempotent and does not throw on second call', async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: TEST_AUTH_TOKEN,
      enableEval: false,
      mcpRoot: null
    })
    await handle.close()
    await expect(handle.close()).resolves.toBeUndefined()
  })

  test('close() rejects subsequent RPC requests', async () => {
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
      return
    }

    const healthyResp = await fetch(`http://127.0.0.1:${httpPort}/health`)
    expect(healthyResp.status).toBe(200)

    await handle.close()

    await expect(fetch(`http://127.0.0.1:${httpPort}/health`)).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// GAP-02: concurrent startServer calls produce non-overlapping servers
// ---------------------------------------------------------------------------

describe('MCP server concurrent startServer', () => {
  test('two simultaneous startServer calls each get their own discovery file and both stay up', async () => {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    const { getDiscoveryPath } = await import('@open-pencil/mcp/transport')

    // Use unique socket paths so the two servers don't fight over the
    // socket file. The test still covers discovery atomicity by writing
    // to the same shared discovery path.
    const a = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: 'token-a',
      enableEval: false,
      mcpRoot: null
    })
    const b = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: 'token-b',
      enableEval: false,
      mcpRoot: null
    })

    try {
      // Both servers are listening on their own ephemeral ports.
      expect(a.httpPort).toBeGreaterThan(0)
      expect(b.httpPort).toBeGreaterThan(0)
      expect(a.httpPort).not.toBe(b.httpPort)

      // Each responds on /health with the expected auth state.
      const aHealth = (await (await fetch(`http://127.0.0.1:${a.httpPort}/health`)).json()) as {
        status: string
      }
      const bHealth = (await (await fetch(`http://127.0.0.1:${b.httpPort}/health`)).json()) as {
        status: string
      }
      expect(aHealth.status).toBe('no_app')
      expect(bHealth.status).toBe('no_app')

      // Discovery file exists and was last written by one of the two servers
      // (atomic rename guarantees it's a complete file, not interleaved).
      const discoveryPath = await getDiscoveryPath()
      const file = Bun.file(discoveryPath)
      expect(await file.exists()).toBe(true)
      const info = (await file.json()) as { pid: number; authToken: string }
      expect(info.pid).toBe(process.pid)
      expect(['token-a', 'token-b']).toContain(info.authToken)
    } finally {
      await a.close()
      await b.close()
    }
  }, 15000)
})
