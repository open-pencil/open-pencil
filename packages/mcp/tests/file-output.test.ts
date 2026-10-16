import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { McpServer } from '@modelcontextprotocol/server'
import { encode } from 'js-base64'

import { registerTools } from '../src/tool/registration'
import { SELECTION_SCOPE_FILE_OUTPUT_ERROR } from '../src/tool/scope'

let root = ''
const open: Client[] = []

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'openpencil-mcp-file-output-'))
})

afterEach(async () => {
  await Promise.all(open.splice(0).map((client) => client.close()))
})

afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true })
})

/** A real MCP server with an MCP root, wired to an in-memory client; the editor answers with `payload`. */
async function connect(
  payload: Record<string, unknown>,
  scope: 'document' | 'selection' = 'document'
) {
  const sent: Record<string, unknown>[] = []
  const server = new McpServer({ name: 'openpencil-test', version: '0.0.0' })
  registerTools(server, {
    policy: { allowEval: false, disabledTools: [], scope },
    mcpRoot: root,
    sendRPC: async (body) => {
      sent.push(body)
      return { ok: true, result: payload }
    }
  })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test-client', version: '0.0.0' })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  open.push(client)
  return { client, sent }
}

describe('a path argument on a tool that does not write files', () => {
  test('path_set keeps its VectorNetwork JSON and writes nothing under the root', async () => {
    const network = JSON.stringify({
      vertices: Array.from({ length: 40 }, (_, i) => ({ x: i * 10, y: i * 5 })),
      segments: [],
      regions: []
    })
    expect(network.length).toBeGreaterThan(300)
    const { client, sent } = await connect({ id: '1:2' })

    const result = await client.callTool({
      name: 'path_set',
      arguments: { id: '1:2', path: network }
    })

    expect(result.isError).toBeFalsy()
    expect(JSON.stringify(sent[0])).toContain('vertices')
    expect(await readdir(root)).toEqual([])
  })

  test('create_vector keeps a long SVG path', async () => {
    const svgPath = `M0 0 ${Array.from({ length: 60 }, (_, i) => `L${i * 3} ${i * 2}`).join(' ')} Z`
    expect(svgPath.length).toBeGreaterThan(300)
    const { client, sent } = await connect({ id: '1:3' })
    const result = await client.callTool({
      name: 'create_vector',
      arguments: { x: 0, y: 0, path: svgPath }
    })
    expect(result.isError).toBeFalsy()
    expect(JSON.stringify(sent[0])).toContain(svgPath)
    expect(await readdir(root)).toEqual([])
  })
})

describe('a path argument on a file-output tool', () => {
  test('export_svg writes the SVG under the root', async () => {
    const { client } = await connect({ svg: '<svg/>' })
    const result = await client.callTool({
      name: 'export_svg',
      arguments: { path: 'out/logo.svg' }
    })
    expect(result.isError).toBeFalsy()
    expect(await readFile(join(root, 'out', 'logo.svg'), 'utf8')).toBe('<svg/>')
  })

  test('export_pdf writes the decoded PDF under the root instead of returning it inline', async () => {
    const pdf = '%PDF-1.4\n%%EOF\n'
    const { client } = await connect({
      mimeType: 'application/pdf',
      base64: encode(pdf),
      byteLength: pdf.length
    })
    const result = await client.callTool({
      name: 'export_pdf',
      arguments: { path: 'out/page.pdf' }
    })
    expect(result.isError).toBeFalsy()
    expect(await readFile(join(root, 'out', 'page.pdf'), 'utf8')).toBe(pdf)
    const text = JSON.stringify(result.content)
    expect(text).toContain('page.pdf')
    expect(text).toContain(`byteLength`)
    expect(text).not.toContain(encode(pdf))
  })

  test('export_pdf cannot write outside the root', async () => {
    const { client } = await connect({ mimeType: 'application/pdf', base64: 'JVBERg==' })
    const result = await client.callTool({
      name: 'export_pdf',
      arguments: { path: '../escape.pdf' }
    })
    expect(result.isError).toBe(true)
  })

  test('a file path outside the root is still refused', async () => {
    const { client } = await connect({ svg: '<svg/>' })
    const result = await client.callTool({
      name: 'export_svg',
      arguments: { path: '../escape.svg' }
    })
    expect(result.isError).toBe(true)
  })

  test('a selection-scoped server still refuses to write files', async () => {
    const { client, sent } = await connect(
      { base64: 'iVBORw0KGgo=', mimeType: 'image/png' },
      'selection'
    )
    const result = await client.callTool({ name: 'export_image', arguments: { path: 'logo.png' } })
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain(SELECTION_SCOPE_FILE_OUTPUT_ERROR)
    expect(sent).toEqual([])
  })
})
