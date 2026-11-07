import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { fromUint8Array } from 'js-base64'

import { createMCPSessionManager } from '#mcp/server/sessions'
import { registerTools } from '#mcp/tool/registration'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()))
})

function request(body: unknown, sessionId?: string) {
  return new Request('http://localhost/mcp', {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...(sessionId ? { 'mcp-session-id': sessionId } : {})
    },
    body: JSON.stringify(body)
  })
}

interface ToolResult {
  isError?: boolean
  content: { type: string; text?: string }[]
}

/** An MCP server over a fresh root whose app answers each tool with `results[name]`. */
async function server(results: Record<string, unknown>) {
  const root = await mkdtemp(join(tmpdir(), 'op-mcp-root-'))
  const manager = createMCPSessionManager({
    serverVersion: '0.0.0',
    registerTools: (mcpServer, agentSession, onToolSettled) =>
      registerTools(mcpServer, {
        policy: { allowEval: false, disabledTools: [], scope: 'document' },
        agentSession,
        onToolSettled,
        mcpRoot: root,
        sendRPC: async (body) => {
          const { args } = body as { args: { name: string } }
          return { ok: true, result: results[args.name] }
        }
      })
  })
  cleanups.push(async () => {
    await manager.clear()
    await rm(root, { recursive: true, force: true })
  })
  const connection = await manager.resolveTransport(undefined)
  if ('error' in connection) throw new Error(connection.error)
  const init = await connection.handleRequest(
    request({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '1' }
      }
    })
  )
  const sessionId = init.headers.get('mcp-session-id') ?? undefined
  let id = 1
  const call = async (name: string, args: Record<string, unknown>): Promise<ToolResult> => {
    const response = await connection.handleRequest(
      request(
        { jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } },
        sessionId
      )
    )
    const text = await response.text()
    const json = text.startsWith('{') ? text : (text.split('data: ')[1] ?? '')
    const message: unknown = JSON.parse(json)
    return (message as { result: ToolResult }).result
  }
  return { root, call }
}

const zigzag = `M0 0${Array.from({ length: 64 }, (_, i) => ` L${(i + 1) * 3} ${(i % 2) * 20}`).join('')}`
const node = { id: '0:1', name: 'Vector', type: 'VECTOR' }

describe('MCP tool file output', () => {
  test("a tool's own path data is never taken for a file", async () => {
    const { root, call } = await server({ create_vector: node, path_set: node })
    const created = await call('create_vector', { x: 0, y: 0, path: zigzag })
    expect(created.isError).toBeFalsy()
    expect(created.content[0].text).toContain('"VECTOR"')
    const network = JSON.stringify({
      vertices: Array.from({ length: 40 }, (_, i) => ({ x: i, y: i % 2 })),
      segments: Array.from({ length: 39 }, (_, i) => ({ start: i, end: i + 1 }))
    })
    expect((await call('path_set', { id: '0:1', path: network })).isError).toBeFalsy()
    expect(await readdir(root)).toEqual([])
  })

  test('export_pdf writes its file, and without a path returns base64 text', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.3 test')
    const result = { mimeType: 'application/pdf', base64: fromUint8Array(pdf), byteLength: 13 }
    const { root, call } = await server({ export_pdf: result })

    const written = await call('export_pdf', { path: 'out/doc.pdf' })
    expect(written.isError).toBeFalsy()
    expect(new Uint8Array(await readFile(join(root, 'out/doc.pdf')))).toEqual(pdf)

    const inline = await call('export_pdf', {})
    expect(inline.content[0].type).toBe('text')
    expect(inline.content[0].text).toContain(result.base64)
  })

  test('set_image_fill resolves image_path into image_data before the app RPC', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const root = await mkdtemp(join(tmpdir(), 'op-mcp-image-'))
    cleanups.push(async () => {
      await rm(root, { recursive: true, force: true })
    })
    await writeFile(join(root, 'plate.png'), png)

    let forwarded: Record<string, unknown> | undefined
    const manager = createMCPSessionManager({
      serverVersion: '0.0.0',
      registerTools: (mcpServer, agentSession, onToolSettled) =>
        registerTools(mcpServer, {
          policy: { allowEval: false, disabledTools: [], scope: 'document' },
          agentSession,
          onToolSettled,
          mcpRoot: root,
          sendRPC: async (body) => {
            const { args } = body as { args: { name: string; args: Record<string, unknown> } }
            if (args.name === 'set_image_fill') forwarded = args.args
            return {
              ok: true,
              result: { id: '1:1', imageHash: 'hash', scaleMode: 'FILL' }
            }
          }
        })
    })
    cleanups.push(async () => {
      await manager.clear()
    })
    const connection = await manager.resolveTransport(undefined)
    if ('error' in connection) throw new Error(connection.error)
    const init = await connection.handleRequest(
      request({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test', version: '1' }
        }
      })
    )
    const sessionId = init.headers.get('mcp-session-id') ?? undefined
    const response = await connection.handleRequest(
      request(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'set_image_fill',
            arguments: { id: '1:1', image_path: 'plate.png', scale_mode: 'FILL' }
          }
        },
        sessionId
      )
    )
    const text = await response.text()
    const json = text.startsWith('{') ? text : (text.split('data: ')[1] ?? '')
    const message = JSON.parse(json) as { result: ToolResult }
    expect(message.result.isError).toBeFalsy()
    expect(forwarded?.image_path).toBeUndefined()
    expect(forwarded?.image_data).toBe(Buffer.from(png).toString('base64'))
    expect(forwarded?.scale_mode).toBe('FILL')
  })
})
