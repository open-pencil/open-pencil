import { describe, expect, test } from 'bun:test'
import { mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

import { SceneGraph } from '@open-pencil/scene-graph'

import { startServer } from '#mcp/server'
import { mcpClientToken } from '#mcp/tool/client-token'
import { parseDiscoveryInfo } from '#mcp/transport/discovery'

import { connectMockBrowser, openWs, readHealth } from '../helpers/server'

const isUnix = process.platform !== 'win32'
const SOCKET_DIR = join(tmpdir(), `openpencil-test-client-token-${process.pid}`)
const ROOT = join(tmpdir(), `open-pencil-client-token-root-${process.pid}`)
const TEST_AUTH_TOKEN = 'test-auth-token'
let testCounter = 0

function testSocketPath(): string | null {
  if (!isUnix) return null
  return join(SOCKET_DIR, `mcp-test-${process.pid}-${++testCounter}.sock`)
}

describe('MCP client token', () => {
  /** A server with eval off and a file root, an app attached, and both of its tokens. */
  async function withServer(
    fn: (server: {
      url: string
      port: number
      clientToken: string
      commands: () => string[]
    }) => Promise<void>
  ) {
    if (isUnix) await mkdir(SOCKET_DIR, { recursive: true })
    await mkdir(ROOT, { recursive: true })
    const handle = await startServer({
      httpPort: 0,
      withTcp: true,
      socketPath: testSocketPath(),
      authToken: TEST_AUTH_TOKEN,
      enableEval: false,
      mcpRoot: ROOT
    })
    const browser = await connectMockBrowser(handle.httpPort, new SceneGraph(), TEST_AUTH_TOKEN)
    try {
      await fn({
        url: `http://127.0.0.1:${handle.httpPort}`,
        port: handle.httpPort,
        clientToken: await mcpClientToken(TEST_AUTH_TOKEN),
        commands: () => browser.requests.map((request) => request.command)
      })
    } finally {
      browser.close()
      await handle.close()
    }
  }

  /** Resolves once the server closes the socket, or rejects if it is still open after a while. */
  function closed(socket: Awaited<ReturnType<typeof openWs>>): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('The socket stayed open')), 2_000)
      socket.once('close', () => {
        clearTimeout(timer)
        resolve()
      })
    })
  }

  test('is a different secret from the server token, and the same one every time', async () => {
    const token = await mcpClientToken(TEST_AUTH_TOKEN)
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(token).not.toContain(TEST_AUTH_TOKEN)
    expect(await mcpClientToken(TEST_AUTH_TOKEN)).toBe(token)
    expect(await mcpClientToken(`${TEST_AUTH_TOKEN}2`)).not.toBe(token)
  })

  test('opens MCP sessions, with the tools the settings leave', async () => {
    await withServer(async ({ url, clientToken }) => {
      const client = new Client({ name: 'client-token', version: '0.0.0' })
      await client.connect(
        new StreamableHTTPClientTransport(new URL(`${url}/mcp`), {
          requestInit: { headers: { Authorization: `Bearer ${clientToken}` } }
        })
      )
      try {
        const names = (await client.listTools()).tools.map((tool) => tool.name)
        expect(names).toContain('get_page_tree')
        expect(names).not.toContain('eval')
      } finally {
        await client.close()
      }
      const health = await fetch(`${url}/health`, {
        headers: { Authorization: `Bearer ${clientToken}` }
      })
      expect((await readHealth(health)).tools).toBeDefined()
    })
  })

  test('does not send raw commands, so eval stays off for its holder', async () => {
    await withServer(async ({ url, clientToken, commands }) => {
      const rpc = (token: string) =>
        fetch(`${url}/rpc`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: 'eval', args: { code: 'figma.currentPage.name' } })
        })

      expect((await rpc(clientToken)).status).toBe(403)
      expect(commands()).toEqual([])
      // The server's own token still does: the CLI and the stdio bridge send raw commands with it.
      expect((await rpc(TEST_AUTH_TOKEN)).status).not.toBe(401)
      expect(commands()).toEqual(['eval'])
    })
  })

  test('does not read or write files through the server', async () => {
    await withServer(async ({ url, clientToken }) => {
      const file = `${url}/files/${join(ROOT, 'note.txt').split(/[\\/]/).map(encodeURIComponent).join('/')}`
      const headers = { Authorization: `Bearer ${clientToken}` }

      expect((await fetch(file, { method: 'PUT', headers, body: 'written' })).status).toBe(403)
      expect((await fetch(file, { headers })).status).toBe(403)
    })
  })

  test('neither registers as the app nor sends requests over the socket', async () => {
    await withServer(async ({ url, port, clientToken, commands }) => {
      const impostor = await openWs(`ws://127.0.0.1:${port}`)
      const impostorClosed = closed(impostor)
      impostor.send(JSON.stringify({ type: 'register', token: clientToken }))
      await impostorClosed

      const sender = await openWs(`ws://127.0.0.1:${port}`)
      const senderClosed = closed(sender)
      sender.send(JSON.stringify({ type: 'auth', token: clientToken }))
      sender.send(
        JSON.stringify({ type: 'request', id: '1', command: 'eval', args: { code: '1' } })
      )
      await senderClosed

      // The app that registered with the server's token is still the one attached.
      const health = await readHealth(await fetch(`${url}/health`))
      expect(health.status).toBe('ok')
      expect(commands()).toEqual([])
    })
  })

  test('is written to the discovery file beside the server token', async () => {
    const { getDiscoveryPath } = await import('#mcp/transport/paths')
    await withServer(async ({ clientToken }) => {
      const info = parseDiscoveryInfo(await readFile(await getDiscoveryPath(), 'utf-8'))
      expect(info?.authToken).toBe(TEST_AUTH_TOKEN)
      expect(info?.clientToken).toBe(clientToken)
    })
  })
})
