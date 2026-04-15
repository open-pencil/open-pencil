import { describe, expect, test, beforeEach, afterEach } from 'bun:test'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { WebSocketServer, type WebSocket } from 'ws'

import {
  ALL_TOOLS,
  FigmaAPI,
  SceneGraph,
  computeAllLayouts,
  executeRpcCommand
} from '@open-pencil/core'

import type { AddressInfo } from 'node:net'

function createMockApp() {
  const graph = new SceneGraph()
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' })
  let clientWs: WebSocket | null = null

  wss.on('connection', (ws) => {
    clientWs = ws
    ws.send(JSON.stringify({ type: 'register', token: 'mock-token' }))

    ws.on('message', async (raw) => {
      const msg = JSON.parse(String(raw)) as {
        type: string
        id: string
        command: string
        args?: { name?: string; args?: Record<string, unknown> }
      }
      if (msg.type !== 'request') return

      try {
        let result: unknown
        if (msg.command === 'tool' && msg.args?.name) {
          const def = ALL_TOOLS.find((t) => t.name === msg.args!.name)
          if (!def) throw new Error(`Unknown tool: ${msg.args.name}`)
          const api = new FigmaAPI(graph)
          api.currentPage = api.wrapNode(graph.getPages()[0].id)
          result = await def.execute(api, msg.args.args ?? {})
          if (def.mutates) computeAllLayouts(graph)
        } else if (msg.command === 'save_file') {
          result = { ok: true }
        } else {
          result = executeRpcCommand(graph, msg.command, msg.args ?? {})
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
  })

  const port = new Promise<number>((resolve) => {
    wss.on('listening', () => resolve((wss.address() as AddressInfo).port))
  })

  return {
    graph,
    wss,
    port,
    close: () => {
      clientWs?.close()
      wss.close()
    }
  }
}

async function createStdioClient(wsPort: number) {
  const transport = new StdioClientTransport({
    command: 'bun',
    args: ['packages/mcp/src/stdio.ts'],
    env: {
      ...process.env,
      WS_PORT: String(wsPort),
      PATH: process.env.PATH ?? ''
    },
    stderr: 'pipe'
  })

  const client = new Client({ name: 'test-stdio-client', version: '0.0.0' })

  await new Promise<void>((resolve) => {
    const stderr = transport.stderr
    if (stderr && 'on' in stderr) {
      ;(stderr as NodeJS.ReadableStream).on('data', (chunk: Buffer) => {
        if (chunk.toString().includes('Connected to OpenPencil app')) {
          resolve()
        }
      })
    }
    void client.connect(transport).then(() => {
      setTimeout(resolve, 1000)
    })
  })

  return { client, transport }
}

describe('MCP stdio transport', () => {
  let app: ReturnType<typeof createMockApp>
  let client: Client
  let transport: StdioClientTransport

  beforeEach(async () => {
    app = createMockApp()
    const wsPort = await app.port
    const ctx = await createStdioClient(wsPort)
    client = ctx.client
    transport = ctx.transport
  })

  afterEach(async () => {
    await client.close()
    app.close()
  })

  test('lists tools over stdio', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toContain('create_shape')
    expect(names).toContain('get_page_tree')
    expect(names).toContain('save_file')
    expect(names).toContain('get_codegen_prompt')
    expect(tools.length).toBeGreaterThan(30)
  })

  test('create_shape via stdio creates a node', async () => {
    const result = await client.callTool({
      name: 'create_shape',
      arguments: { type: 'FRAME', x: 10, y: 20, width: 200, height: 100, name: 'StdioFrame' }
    })
    expect(result.isError).not.toBe(true)
    const data = JSON.parse(
      (result.content as { type: string; text: string }[]).find((c) => c.type === 'text')!.text
    ) as { id: string; name: string; type: string }
    expect(data.type).toBe('FRAME')
    expect(data.name).toBe('StdioFrame')

    const node = app.graph.getNode(data.id)
    expect(node).toBeDefined()
    expect(node!.width).toBe(200)
  })

  test('save_file via stdio succeeds', async () => {
    const result = await client.callTool({ name: 'save_file', arguments: {} })
    expect(result.isError).not.toBe(true)
    const data = JSON.parse(
      (result.content as { type: string; text: string }[]).find((c) => c.type === 'text')!.text
    ) as { saved: boolean }
    expect(data.saved).toBe(true)
  })

  test('get_codegen_prompt via stdio returns prompt', async () => {
    const result = await client.callTool({ name: 'get_codegen_prompt', arguments: {} })
    expect(result.isError).not.toBe(true)
    const data = JSON.parse(
      (result.content as { type: string; text: string }[]).find((c) => c.type === 'text')!.text
    ) as { prompt: string }
    expect(data.prompt.length).toBeGreaterThan(100)
  })

  test('delete_node via stdio removes a node', async () => {
    const create = await client.callTool({
      name: 'create_shape',
      arguments: { type: 'RECTANGLE', x: 0, y: 0, width: 50, height: 50 }
    })
    const { id } = JSON.parse(
      (create.content as { type: string; text: string }[]).find((c) => c.type === 'text')!.text
    ) as { id: string }

    expect(app.graph.getNode(id)).toBeDefined()

    await client.callTool({ name: 'delete_node', arguments: { id } })

    expect(app.graph.getNode(id)).toBeUndefined()
  })

  test('stderr does not contain JSON-RPC', async () => {
    const stderrChunks: string[] = []
    const stderr = transport.stderr
    if (stderr && 'on' in stderr) {
      ;(stderr as NodeJS.ReadableStream).on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk.toString())
      })
    }

    await client.callTool({
      name: 'create_shape',
      arguments: { type: 'FRAME', x: 0, y: 0, width: 100, height: 100 }
    })

    const allStderr = stderrChunks.join('')
    expect(allStderr).not.toContain('"jsonrpc"')
    expect(allStderr).not.toContain('"method"')
  })
})
