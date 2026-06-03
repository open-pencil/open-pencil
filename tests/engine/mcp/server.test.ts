import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { serve } from '@hono/node-server'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import WebSocket from 'ws'

import {
  ALL_TOOLS,
  FigmaAPI,
  SceneGraph,
  computeAllLayouts,
  executeRpcCommand
} from '@inkly/core'

import { startServer, paramToZod } from '#mcp/server'

interface MockBrowserRequest {
  command: string
  args?: unknown
}

interface MockBrowser {
  ws: WebSocket
  graph: SceneGraph
  requests: MockBrowserRequest[]
  close: () => void
}

const TEST_MCP_ROOT = path.join(tmpdir(), 'inkly-mcp-root')

function connectMockBrowser(port: number, graph: SceneGraph): Promise<MockBrowser> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    const requests: MockBrowserRequest[] = []
    const token = 'test-token-' + Date.now()

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'register', token }))

      ws.on('message', async (raw) => {
        const msg = JSON.parse(raw.toString()) as {
          type: string
          id: string
          command: string
          args?: unknown
        }
        if (msg.type !== 'request') return

        try {
          const command = msg.command
          requests.push({ command, args: msg.args })
          const args = msg.args as { name?: string; args?: Record<string, unknown> } | undefined

          let result: unknown
          if (command === 'tool' && args?.name) {
            const def = ALL_TOOLS.find((t) => t.name === args.name)
            if (!def) throw new Error(`Unknown tool: ${args.name}`)
            const api = new FigmaAPI(graph)
            api.currentPage = api.wrapNode(graph.getPages()[0].id)
            result = await def.execute(api, args.args ?? {})
            if (def.mutates) computeAllLayouts(graph)
          } else if (
            command === 'save_file' ||
            command === 'new_document' ||
            command === 'open_file'
          ) {
            result = {}
          } else {
            result = executeRpcCommand(graph, command, args ?? {})
          }

          ws.send(JSON.stringify({ type: 'response', id: msg.id, ok: true, result }))
        } catch (e) {
          ws.send(
            JSON.stringify({
              type: 'response',
              id: msg.id,
              ok: false,
              error: e instanceof Error ? e.message : String(e)
            })
          )
        }
      })

      resolve({ ws, graph, requests, close: () => ws.close() })
    })

    ws.on('error', reject)
  })
}

function readWsJson<T>(ws: WebSocket): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Timed out waiting for WebSocket message')),
      1000
    )
    ws.once('message', (raw) => {
      clearTimeout(timer)
      try {
        resolve(JSON.parse(raw.toString()) as T)
      } catch (error) {
        reject(error)
      }
    })
    ws.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

function openWs(url: string): Promise<WebSocket> {
  const ws = new WebSocket(url)
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}

function waitForWsListening(wss: InstanceType<typeof WebSocket.Server>): Promise<number> {
  return new Promise((resolve) => {
    if (wss.address()) {
      resolve((wss.address() as AddressInfo).port)
      return
    }
    wss.on('listening', () => resolve((wss.address() as AddressInfo).port))
  })
}

async function createTestClient() {
  const { app, wss, close: closeServer } = startServer({ httpPort: 0, wsPort: 0 })
  const httpServer = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' })
  const actualHttpPort = (httpServer.address() as AddressInfo).port
  const actualWsPort = await waitForWsListening(wss)

  const graph = new SceneGraph()
  const browser = await connectMockBrowser(actualWsPort, graph)

  const client = new Client({ name: 'test-client', version: '0.0.0' })
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${actualHttpPort}/mcp`)
  )
  await client.connect(transport)

  return {
    client,
    graph,
    close: async () => {
      await client.close()
      browser.close()
      closeServer()
      httpServer.close()
    }
  }
}

function parseResult(result: { content: { type: string; text?: string }[] }): unknown {
  const textContent = result.content.find((c) => c.type === 'text')
  return textContent?.text ? JSON.parse(textContent.text) : null
}

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

describe('MCP Streamable HTTP transport', () => {
  test('returns JSON responses for request/response calls', async () => {
    const { app, close: closeServer } = startServer({ httpPort: 0, wsPort: 0 })
    const httpServer = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' })
    const actualHttpPort = (httpServer.address() as AddressInfo).port

    try {
      const response = await fetch(`http://127.0.0.1:${actualHttpPort}/mcp`, {
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
            clientInfo: { name: 'raw-test', version: '0.0.0' }
          }
        })
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/json')
      expect(response.headers.get('content-type')).not.toContain('text/event-stream')
    } finally {
      closeServer()
      httpServer.close()
    }
  })
})

describe('MCP WebSocket stdio bridge routing', () => {
  test('forwards stdio client requests to the registered desktop app', async () => {
    const { wss, close: closeServer } = startServer({ httpPort: 0, wsPort: 0 })
    const wsPort = await waitForWsListening(wss)
    const graph = new SceneGraph()
    const browser = await connectMockBrowser(wsPort, graph)
    const clientWs = await openWs(`ws://127.0.0.1:${wsPort}`)

    try {
      const register = await readWsJson<{ type: string; token?: string }>(clientWs)
      expect(register.type).toBe('register')
      expect(register.token).toBeTruthy()

      clientWs.send(
        JSON.stringify({
          type: 'request',
          id: 'stdio-1',
          command: 'tool',
          args: { name: 'get_current_page', args: {} }
        })
      )
      const response = await readWsJson<{
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
      closeServer()
    }
  })

  test('returns a disconnected response instead of timing out when no app is registered', async () => {
    const { wss, close: closeServer } = startServer({ httpPort: 0, wsPort: 0 })
    const wsPort = await waitForWsListening(wss)
    const clientWs = await openWs(`ws://127.0.0.1:${wsPort}`)

    try {
      clientWs.send(
        JSON.stringify({
          type: 'request',
          id: 'stdio-no-app',
          command: 'tool',
          args: { name: 'get_current_page', args: {} }
        })
      )
      const response = await readWsJson<{ type: string; id: string; ok?: boolean; error?: string }>(
        clientWs
      )

      expect(response.type).toBe('response')
      expect(response.id).toBe('stdio-no-app')
      expect(response.ok).toBe(false)
      expect(response.error).toContain('Inkly app is not connected')
    } finally {
      clientWs.close()
      closeServer()
    }
  })

  test('notifies already-connected stdio clients when the desktop app registers later', async () => {
    const { wss, close: closeServer } = startServer({ httpPort: 0, wsPort: 0 })
    const wsPort = await waitForWsListening(wss)
    const clientWs = await openWs(`ws://127.0.0.1:${wsPort}`)
    const graph = new SceneGraph()
    let browser: MockBrowser | null = null

    try {
      browser = await connectMockBrowser(wsPort, graph)
      const register = await readWsJson<{ type: string; token?: string }>(clientWs)
      expect(register.type).toBe('register')
      expect(register.token).toBeTruthy()
    } finally {
      clientWs.close()
      browser?.close()
      closeServer()
    }
  })

  test('routes new requests to the latest registered desktop app after reconnect', async () => {
    const { wss, close: closeServer } = startServer({ httpPort: 0, wsPort: 0 })
    const wsPort = await waitForWsListening(wss)
    const firstBrowser = await connectMockBrowser(wsPort, new SceneGraph())
    const secondBrowser = await connectMockBrowser(wsPort, new SceneGraph())
    const clientWs = await openWs(`ws://127.0.0.1:${wsPort}`)

    try {
      await readWsJson<{ type: string; token?: string }>(clientWs)
      clientWs.send(
        JSON.stringify({
          type: 'request',
          id: 'stdio-after-reconnect',
          command: 'tool',
          args: { name: 'get_current_page', args: {} }
        })
      )
      const response = await readWsJson<{ type: string; id: string; ok?: boolean }>(clientWs)

      expect(response.type).toBe('response')
      expect(response.id).toBe('stdio-after-reconnect')
      expect(response.ok).toBe(true)
      expect(firstBrowser.requests).toHaveLength(0)
      expect(secondBrowser.requests.at(-1)?.command).toBe('tool')
    } finally {
      clientWs.close()
      firstBrowser.close()
      secondBrowser.close()
      closeServer()
    }
  })
})

describe('MCP server with mcpRoot', () => {
  test('registers open_file and new_document tools when mcpRoot is set', async () => {
    const {
      app,
      wss,
      close: closeServer
    } = startServer({ httpPort: 0, wsPort: 0, mcpRoot: TEST_MCP_ROOT })
    const httpServer = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' })
    const actualWsPort = await waitForWsListening(wss)

    const graph = new SceneGraph()
    const browser = await connectMockBrowser(actualWsPort, graph)

    const client = new Client({ name: 'test-root', version: '0.0.0' })
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${(httpServer.address() as AddressInfo).port}/mcp`)
    )
    await client.connect(transport)

    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toContain('open_file')
    expect(names).toContain('new_document')

    await client.close()
    browser.close()
    closeServer()
    httpServer.close()
  })

  test('save_file accepts an explicit path inside mcpRoot', async () => {
    const {
      app,
      wss,
      close: closeServer
    } = startServer({ httpPort: 0, wsPort: 0, mcpRoot: TEST_MCP_ROOT })
    const httpServer = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' })
    const actualWsPort = await waitForWsListening(wss)

    const graph = new SceneGraph()
    const browser = await connectMockBrowser(actualWsPort, graph)

    const client = new Client({ name: 'test-root-save', version: '0.0.0' })
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${(httpServer.address() as AddressInfo).port}/mcp`)
    )
    await client.connect(transport)

    const savePath = path.join(TEST_MCP_ROOT, 'unicode', 'пример.fig')
    const result = await client.callTool({
      name: 'save_file',
      arguments: { path: savePath }
    })

    expect(result.isError).not.toBe(true)
    const request = browser.requests.find((item) => item.command === 'save_file')
    expect(request?.args).toEqual({ path: savePath })

    await client.close()
    browser.close()
    closeServer()
    httpServer.close()
  })

  test('save_file rejects paths outside mcpRoot', async () => {
    const {
      app,
      wss,
      close: closeServer
    } = startServer({ httpPort: 0, wsPort: 0, mcpRoot: TEST_MCP_ROOT })
    const httpServer = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' })
    const actualWsPort = await waitForWsListening(wss)

    const graph = new SceneGraph()
    const browser = await connectMockBrowser(actualWsPort, graph)

    const client = new Client({ name: 'test-root-save-outside', version: '0.0.0' })
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${(httpServer.address() as AddressInfo).port}/mcp`)
    )
    await client.connect(transport)

    const result = await client.callTool({
      name: 'save_file',
      arguments: { path: path.join(path.dirname(TEST_MCP_ROOT), 'outside.fig') }
    })

    expect(result.isError).toBe(true)
    expect(browser.requests.some((item) => item.command === 'save_file')).toBe(false)

    await client.close()
    browser.close()
    closeServer()
    httpServer.close()
  })

  test('does not register open_file when mcpRoot is null', async () => {
    const { app, wss, close: closeServer } = startServer({ httpPort: 0, wsPort: 0 })
    const httpServer = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' })
    const actualWsPort = await waitForWsListening(wss)

    const graph = new SceneGraph()
    const browser = await connectMockBrowser(actualWsPort, graph)

    const client = new Client({ name: 'test-no-root', version: '0.0.0' })
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${(httpServer.address() as AddressInfo).port}/mcp`)
    )
    await client.connect(transport)

    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).not.toContain('open_file')
    expect(names).not.toContain('new_document')

    await client.close()
    browser.close()
    closeServer()
    httpServer.close()
  })
})

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
