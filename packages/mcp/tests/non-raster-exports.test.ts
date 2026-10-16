import { afterEach, describe, expect, test } from 'bun:test'

import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { McpServer } from '@modelcontextprotocol/server'

import { binaryContent, isRasterImageMime } from '../src/result'
import { registerTools } from '../src/tool/registration'

const PDF = { mimeType: 'application/pdf', base64: 'JVBERi0xLjMK', byteLength: 9 }
const SVG = { mimeType: 'image/svg+xml', base64: 'PHN2Zy8+' }
const PNG = { mimeType: 'image/png', base64: 'iVBORw0KGgo=' }

const open: Client[] = []

/** A real MCP server wired to an in-memory client, with the editor answering every tool with `payload`. */
async function connect(payload: Record<string, unknown>): Promise<Client> {
  const server = new McpServer({ name: 'openpencil-test', version: '0.0.0' })
  registerTools(server, {
    policy: { allowEval: false, disabledTools: [], scope: 'document' },
    sendRPC: async () => ({ ok: true, result: payload })
  })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test-client', version: '0.0.0' })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  open.push(client)
  return client
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((client) => client.close()))
})

describe('non-raster exports never leave the MCP server as image content', () => {
  test('only PNG, JPEG, GIF, and WEBP count as raster images', () => {
    for (const mime of ['image/png', 'image/jpeg', 'IMAGE/GIF', 'image/webp']) {
      expect(isRasterImageMime(mime)).toBe(true)
    }
    for (const mime of ['application/pdf', 'image/svg+xml', 'image/tiff']) {
      expect(isRasterImageMime(mime)).toBe(false)
    }
  })

  test('export_pdf returns the PDF as an embedded resource', async () => {
    const client = await connect(PDF)
    const { content } = await client.callTool({ name: 'export_pdf', arguments: {} })
    expect(content).toEqual([
      {
        type: 'resource',
        resource: {
          uri: 'openpencil://export/export_pdf',
          mimeType: 'application/pdf',
          blob: PDF.base64
        }
      }
    ])
  })

  test('an SVG payload comes back as a text resource', async () => {
    const client = await connect(SVG)
    const { content } = await client.callTool({ name: 'export_image', arguments: {} })
    expect(content).toEqual([
      {
        type: 'resource',
        resource: {
          uri: 'openpencil://export/export_image',
          mimeType: 'image/svg+xml',
          text: '<svg/>'
        }
      }
    ])
  })

  test('a raster image keeps its image part', async () => {
    const client = await connect(PNG)
    const { content } = await client.callTool({ name: 'export_image', arguments: {} })
    expect(content).toEqual([{ type: 'image', data: PNG.base64, mimeType: 'image/png' }])
  })

  test('no tool returns a non-raster image part', async () => {
    let called = 0
    for (const payload of [PDF, SVG, PNG]) {
      const client = await connect(payload)
      const { tools } = await client.listTools()
      for (const tool of tools) {
        const result = await client.callTool({ name: tool.name, arguments: {} }).catch(() => null)
        if (!result || !Array.isArray(result.content)) continue
        called++
        for (const part of result.content) {
          if (part.type === 'image') {
            expect([tool.name, isRasterImageMime(part.mimeType)]).toEqual([tool.name, true])
          }
        }
      }
    }
    expect(called).toBeGreaterThan(50)
  })

  test('binaryContent decides by MIME type alone', () => {
    expect(binaryContent('AAAA', 'image/webp', 'x').type).toBe('image')
    expect(binaryContent('AAAA', 'application/pdf', 'x').type).toBe('resource')
  })
})
