import { describe, expect, test, beforeEach, afterEach } from 'bun:test'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import WebSocket from 'ws'

import { startServer } from '../../packages/mcp/src/server'
import {
  ALL_TOOLS,
  FigmaAPI,
  SceneGraph,
  computeAllLayouts,
  executeRpcCommand
} from '@open-pencil/core'
import { serve } from '@hono/node-server'

import type { AddressInfo } from 'node:net'

interface MockBrowser {
  ws: WebSocket
  graph: SceneGraph
  close: () => void
}

function connectMockBrowser(port: number, graph: SceneGraph): Promise<MockBrowser> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
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
          const args = msg.args as { name?: string; args?: Record<string, unknown> } | undefined

          let result: unknown
          if (command === 'tool' && args?.name) {
            const def = ALL_TOOLS.find((t) => t.name === args.name)
            if (!def) throw new Error(`Unknown tool: ${args.name}`)
            const api = new FigmaAPI(graph)
            api.currentPage = api.wrapNode(graph.getPages()[0].id)
            result = await def.execute(api, args.args ?? {})
            if (def.mutates) computeAllLayouts(graph)
          } else {
            result = executeRpcCommand(graph, command, args ?? {})
          }

          ws.send(JSON.stringify({ type: 'response', id: msg.id, ok: true, result }))
        } catch (e) {
          ws.send(JSON.stringify({
            type: 'response',
            id: msg.id,
            ok: false,
            error: e instanceof Error ? e.message : String(e)
          }))
        }
      })

      resolve({ ws, graph, close: () => ws.close() })
    })

    ws.on('error', reject)
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
  const { app, wss } = startServer({ httpPort: 0, wsPort: 0 })
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
      wss.close()
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
