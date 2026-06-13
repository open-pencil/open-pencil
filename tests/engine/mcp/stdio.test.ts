import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

import { SceneGraph } from '@open-pencil/core'
import { startServer, type ServerHandle } from '@open-pencil/mcp'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'

import { connectMockBrowser, type MockBrowser } from './helpers'

const AUTH_TOKEN = 'test-stdio-token'
const isUnix = process.platform !== 'win32'
const SOCKET_DIR = join(tmpdir(), `openpencil-test-stdio-${process.pid}`)
const SOCKET_PATH = isUnix ? join(SOCKET_DIR, 'mcp.sock') : null

async function createStdioClient(socketPath: string, authToken: string | null) {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PATH: process.env.PATH ?? ''
  }
  // Only set OPENPENCIL_MCP_SOCKET when a socket path exists.
  // An empty string on Windows would break the stdio bridge's transport
  // discovery (it would try to connect to an empty socket path).
  if (socketPath) {
    env.OPENPENCIL_MCP_SOCKET = socketPath
  }
  if (authToken) {
    env.OPENPENCIL_MCP_AUTH_TOKEN = authToken
  }
  const transport = new StdioClientTransport({
    command: 'bun',
    args: ['packages/mcp/src/stdio.ts'],
    env,
    stderr: 'pipe'
  })

  const client = new Client({ name: 'test-stdio-client', version: '0.0.0' })

  // The bridge must connect to the server before tool calls can work.
  // Wait for "Connected to OpenPencil" on stderr — this confirms the
  // bridge's checkHealth() succeeded and ready=true.
  // Also reject on timeout or stream end so the test fails fast if the
  // bridge never connects.
  const BRIDGE_TIMEOUT = 10_000
  const bridgeConnected = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Bridge did not connect within timeout'))
    }, BRIDGE_TIMEOUT)

    const stderr = transport.stderr
    if (stderr && 'on' in stderr) {
      const stream = stderr as NodeJS.ReadableStream
      stream.on('data', (chunk: Buffer) => {
        if (chunk.toString().includes('Connected to OpenPencil')) {
          clearTimeout(timer)
          resolve()
        }
      })
      stream.on('end', () => {
        clearTimeout(timer)
        reject(new Error('Bridge stderr stream ended before connection'))
      })
      stream.on('error', (err: Error) => {
        clearTimeout(timer)
        reject(new Error(`Bridge stderr error: ${err.message}`))
      })
    } else {
      clearTimeout(timer)
      reject(new Error('No stderr stream available'))
    }
  })

  // Start the MCP session and wait for the bridge to be ready in parallel.
  // client.connect() handles the JSON-RPC initialize/handshake;
  // bridgeConnected confirms the bridge can actually reach the server.
  await Promise.all([client.connect(transport), bridgeConnected])

  return { client, transport }
}

function textContent(content: unknown): string {
  const items = content as { type: string; text: string }[]
  return expectDefined(
    items.find((c) => c.type === 'text'),
    'text content'
  ).text
}

describe('MCP stdio transport', () => {
  let handle: ServerHandle
  let graph: SceneGraph
  let browser: MockBrowser
  let client: Client
  let transport: StdioClientTransport

  beforeEach(async () => {
    graph = new SceneGraph()

    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })

    handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: SOCKET_PATH,
      authToken: AUTH_TOKEN,
      enableEval: false,
      mcpRoot: null
    })

    if (!handle.httpPort) {
      await handle.close().catch(() => undefined)
      throw new Error('TCP listener not started — httpPort is undefined')
    }

    browser = await connectMockBrowser(handle.httpPort, graph, AUTH_TOKEN)

    const maxWait = 5000
    const start = Date.now()
    let lastStatus = 'unknown'
    let ready = false
    while (Date.now() - start < maxWait) {
      try {
        const resp = await fetch(`http://127.0.0.1:${handle.httpPort}/health`)
        lastStatus = ((await resp.json()) as { status: string }).status
        if (lastStatus === 'ok') {
          ready = true
          break
        }
      } catch {
        // Transient fetch/json failure — retry after delay
        void 0
      }
      await new Promise<void>((r) => {
        setTimeout(r, 200)
      })
    }
    if (!ready) {
      throw new Error(
        `Server did not reach health.status === 'ok' within ${maxWait}ms (last status: ${lastStatus})`
      )
    }

    const socketPath = handle.socketPath ?? ''
    if (isUnix && !socketPath) {
      await handle.close().catch(() => undefined)
      throw new Error('Unix socket listener not started — socketPath is undefined')
    }
    const ctx = await createStdioClient(socketPath, AUTH_TOKEN)
    client = ctx.client
    transport = ctx.transport
  }, 10000)

  afterEach(async () => {
    if (client) await client.close().catch(() => undefined)
    if (browser) browser.close()
    if (handle) await handle.close().catch(() => undefined)
    if (isUnix) await rm(SOCKET_DIR, { recursive: true, force: true })
  })

  test('lists tools over stdio', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toContain('create_shape')
    expect(names).toContain('get_page_tree')
    expect(names).toContain('save_file')
    expect(names).toContain('get_codegen_prompt')
    expect(tools.length).toBeGreaterThan(30)
  }, 10000)

  test('create_shape via stdio creates a node', async () => {
    const result = await client.callTool({
      name: 'create_shape',
      arguments: { type: 'FRAME', x: 10, y: 20, width: 200, height: 100, name: 'StdioFrame' }
    })
    expect(result.isError).not.toBe(true)
    const data = JSON.parse(textContent(result.content)) as {
      id: string
      name: string
      type: string
    }
    expect(data.type).toBe('FRAME')
    expect(data.name).toBe('StdioFrame')

    expect(getNodeOrThrow(graph, data.id).width).toBe(200)
  }, 10000)

  test('save_file via stdio succeeds', async () => {
    const result = await client.callTool({ name: 'save_file', arguments: {} })
    expect(result.isError).not.toBe(true)
    const data = JSON.parse(textContent(result.content)) as { saved: boolean }
    expect(data.saved).toBe(true)
  }, 10000)

  test('get_codegen_prompt via stdio returns prompt', async () => {
    const result = await client.callTool({ name: 'get_codegen_prompt', arguments: {} })
    expect(result.isError).not.toBe(true)
    const data = JSON.parse(textContent(result.content)) as { prompt: string }
    expect(data.prompt.length).toBeGreaterThan(100)
  }, 10000)

  test('sequential tool calls work (create then delete)', async () => {
    const create = await client.callTool({
      name: 'create_shape',
      arguments: { type: 'RECTANGLE', x: 0, y: 0, width: 50, height: 50 }
    })
    expect(create.isError).not.toBe(true)
    const { id } = JSON.parse(textContent(create.content)) as { id: string }

    expect(getNodeOrThrow(graph, id)).toBeDefined()

    await client.callTool({ name: 'delete_node', arguments: { id } })
    expect(graph.getNode(id)).toBeUndefined()
  }, 10000)

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
  }, 10000)
})
