import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { fromUint8Array } from 'js-base64'

import { imageDataURL } from '@open-pencil/scene-graph/images'

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

/**
 * An MCP server over a fresh root whose app answers each tool with `results[name]`, keeping the
 * arguments each call reached the app with in `sent`.
 */
async function server(results: Record<string, unknown>) {
  const root = await mkdtemp(join(tmpdir(), 'op-mcp-root-'))
  const sent: Record<string, unknown>[] = []
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
          sent.push(args.args)
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
  return { root, sent, call }
}

const zigzag = `M0 0${Array.from({ length: 64 }, (_, i) => ` L${(i + 1) * 3} ${(i % 2) * 20}`).join('')}`
const node = { id: '0:1', name: 'Vector', type: 'VECTOR' }

describe('MCP tool file output', () => {
  test("a tool's own path data is never taken for a file", async () => {
    const { root, call } = await server({ create_vector: node, set_path: node })
    const created = await call('create_vector', { x: 0, y: 0, path: zigzag })
    expect(created.isError).toBeFalsy()
    expect(created.content[0].text).toContain('"VECTOR"')
    const network = JSON.stringify({
      vertices: Array.from({ length: 40 }, (_, i) => ({ x: i, y: i % 2 })),
      segments: Array.from({ length: 39 }, (_, i) => ({ start: i, end: i + 1 }))
    })
    expect((await call('set_path', { id: '0:1', path: network })).isError).toBeFalsy()
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

  test('get_jsx written to a path reports that the JSX was truncated', async () => {
    const jsx = '<Frame name="Card">'.padEnd(12_000, ' ')
    const result = { id: '0:1', name: 'Card', jsx, truncated: true, totalLength: 26_349 }
    const { root, call } = await server({ get_jsx: result })

    const written = await call('get_jsx', { id: '0:1', path: 'card.jsx' })
    expect(written.isError).toBeFalsy()
    expect(await readFile(join(root, 'card.jsx'), 'utf8')).toBe(jsx)
    const response: unknown = JSON.parse(written.content[0].text ?? '')
    expect(response).toMatchObject({ byteLength: 12_000, truncated: true, totalLength: 26_349 })
  })
})

describe('MCP tool file input', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const filled = { id: '0:1', imageHash: 'hash', scaleMode: 'FILL' }

  test('set_image_fill sends the app the bytes of image_path, read inside the root', async () => {
    const { root, sent, call } = await server({ set_image_fill: filled })
    await writeFile(join(root, 'photo.png'), png)

    const result = await call('set_image_fill', { id: '0:1', image_path: 'photo.png' })
    expect(result.isError).toBeFalsy()
    expect(sent).toEqual([{ id: '0:1', image_data: fromUint8Array(png), scale_mode: 'FILL' }])
  })

  test('set_image_fill passes image_data through and refuses a file outside the root', async () => {
    const { sent, call } = await server({ set_image_fill: filled })
    const data = imageDataURL(png)
    expect((await call('set_image_fill', { id: '0:1', image_data: data })).isError).toBeFalsy()
    expect(sent).toEqual([{ id: '0:1', image_data: data, scale_mode: 'FILL' }])

    const outside = await call('set_image_fill', { id: '0:1', image_path: '../photo.png' })
    expect(outside.isError).toBe(true)
    expect(sent).toHaveLength(1)
  })

  test('set_image_fill takes one of image_path and image_data', async () => {
    const { root, sent, call } = await server({ set_image_fill: filled })
    await writeFile(join(root, 'photo.png'), png)

    const neither = await call('set_image_fill', { id: '0:1' })
    expect(neither.content[0].text).toContain('Pass image_path or image_data')
    const both = await call('set_image_fill', {
      id: '0:1',
      image_path: 'photo.png',
      image_data: fromUint8Array(png)
    })
    expect(both.content[0].text).toContain('not both')
    expect(sent).toEqual([])
  })
})
