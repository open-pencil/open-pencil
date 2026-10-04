import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { runCommand } from 'citty'

import type { AutomationDocumentSummary } from '@open-pencil/core/rpc'
import { removeDiscoveryFile, writeDiscoveryFile } from '@open-pencil/mcp/discovery'

import exportCommand from '#cli/commands/export'

type RPCRequest = { command: string; args: Record<string, unknown> }

const DOCUMENT: AutomationDocumentSummary = {
  id: 'tab-1',
  name: 'Statements',
  active: true,
  current_page_id: '0:1',
  current_page_name: 'Dashboard',
  pages: [
    { id: '0:1', name: 'Dashboard' },
    { id: '0:2', name: 'Worklist' }
  ]
}

let server: Server
let requests: RPCRequest[] = []
let dir: string
let discoveryDir: string
const savedDiscoveryPath = process.env.OPENPENCIL_MCP_DISCOVERY_PATH

function reply(command: string): unknown {
  if (command === 'list_documents') return { documents: [DOCUMENT] }
  if (command === 'tool') return { svg: '<svg/>' }
  return { base64: 'AQID' }
}

beforeAll(async () => {
  // Our own discovery file, so a running app's record is neither replaced nor removed.
  discoveryDir = await mkdtemp(join(tmpdir(), 'open-pencil-export-discovery-'))
  process.env.OPENPENCIL_MCP_DISCOVERY_PATH = join(discoveryDir, 'mcp.json')
  server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as RPCRequest
      requests.push(body)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ ok: true, result: reply(body.command) }))
    })
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  await writeDiscoveryFile({
    pid: process.pid,
    socketPath: null,
    httpPort: (server.address() as AddressInfo).port,
    authRequired: false,
    authToken: null,
    version: '0.0.0-test',
    startedAt: new Date().toISOString()
  })
})

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve())
  })
  await removeDiscoveryFile()
  if (savedDiscoveryPath === undefined) delete process.env.OPENPENCIL_MCP_DISCOVERY_PATH
  else process.env.OPENPENCIL_MCP_DISCOVERY_PATH = savedDiscoveryPath
  await rm(discoveryDir, { recursive: true, force: true })
})

beforeEach(async () => {
  requests = []
  dir = await mkdtemp(join(tmpdir(), 'open-pencil-export-app-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function lastRequest(command: string): RPCRequest | undefined {
  return requests.findLast((request) => request.command === command)
}

describe('export from the running app', () => {
  test('--page exports the named page, not the page on screen', async () => {
    await runCommand(exportCommand, {
      rawArgs: ['--page', 'Worklist', '-o', join(dir, 'worklist.png')]
    })

    expect(lastRequest('export')?.args).toMatchObject({ page_id: '0:2', scope: 'page' })
  })

  test('--page-id exports that page rather than the selection', async () => {
    await runCommand(exportCommand, {
      rawArgs: ['--page-id', '0:2', '-o', join(dir, 'worklist.png')]
    })

    expect(lastRequest('export')?.args).toMatchObject({ page_id: '0:2', scope: 'page' })
  })

  test('--page targets the named page for vector formats', async () => {
    await runCommand(exportCommand, {
      rawArgs: ['--page', 'Worklist', '-f', 'svg', '-o', join(dir, 'worklist.svg')]
    })

    expect(lastRequest('tool')?.args).toMatchObject({ page_id: '0:2', name: 'export_svg' })
  })
})
