import { afterAll, beforeAll, beforeEach, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { CLI_ENTRY } from '#cli-tests/helpers/paths'

setDefaultTimeout(60_000)

const TOKEN = 'cli-app-test-token'
const TARGET = {
  documentId: 'doc-2',
  documentName: 'Landing',
  pageId: '0:1',
  pageName: 'Page 1'
}

type Request = { command: string; args: Record<string, unknown> }

const requests: Request[] = []
const responses = new Map<string, unknown>()
let server: Server
let discoveryPath: string

beforeAll(async () => {
  server = createServer((request, response) => {
    let body = ''
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    request.on('end', () => {
      const parsed = JSON.parse(body) as Request
      requests.push(parsed)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({ ok: true, result: responses.get(parsed.command) ?? {}, target: TARGET })
      )
    })
  })
  await new Promise<void>((done) => {
    server.listen(0, '127.0.0.1', done)
  })
  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-cli-app-'))
  discoveryPath = join(dir, 'discovery.json')
  await writeFile(
    discoveryPath,
    JSON.stringify({
      pid: process.pid,
      socketPath: join(dir, 'missing.sock'),
      httpPort: (server.address() as AddressInfo).port,
      authRequired: true,
      authToken: TOKEN,
      version: '0.0.0-test',
      startedAt: new Date().toISOString()
    })
  )
})

afterAll(() => {
  server.close()
})

beforeEach(() => {
  requests.length = 0
  responses.clear()
})

async function cli(args: string[]) {
  const proc = Bun.spawn([process.execPath, CLI_ENTRY, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, OPENPENCIL_MCP_DISCOVERY_PATH: discoveryPath }
  })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ])
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: await proc.exited }
}

describe('documents CLI', () => {
  test('opens files by absolute path and reports the target document', async () => {
    const opened = await cli(['documents', 'open', 'designs/landing.fig', '--json'])
    expect(opened.exitCode).toBe(0)
    expect(requests).toEqual([
      { command: 'open_file', args: { path: resolve('designs/landing.fig') } }
    ])
    expect(JSON.parse(opened.stdout)).toEqual({ result: {}, target: TARGET })
  })

  test('saves, closes, and activates a targeted document', async () => {
    await cli(['documents', 'save', '--document-id', 'doc-2', '--path', 'out.fig'])
    await cli(['documents', 'close', '--document-id', 'doc-2', '--discard'])
    await cli(['documents', 'activate', 'doc-2', '--page-id', '0:1'])
    expect(requests).toEqual([
      { command: 'save_file', args: { document_id: 'doc-2', path: resolve('out.fig') } },
      { command: 'close_file', args: { document_id: 'doc-2', unsaved: 'discard' } },
      { command: 'activate_document', args: { document_id: 'doc-2', page_id: '0:1' } }
    ])
  })

  test('close --save forwards the save choice and an absolute path', async () => {
    await cli(['documents', 'close', '--save', '--path', 'draft.fig'])
    expect(requests).toEqual([
      { command: 'close_file', args: { unsaved: 'save', path: resolve('draft.fig') } }
    ])
    const both = await cli(['documents', 'close', '--save', '--discard'])
    expect(both.exitCode).toBe(1)
  })
})

describe('history CLI', () => {
  test('reports the undone change', async () => {
    responses.set('undo', { applied: true, label: 'Agent: set_opacity' })
    const undone = await cli(['undo', '--document-id', 'doc-2'])
    expect(undone.exitCode).toBe(0)
    expect(undone.stdout).toContain('Undid: Agent: set_opacity')
    expect(requests).toEqual([{ command: 'undo', args: { document_id: 'doc-2' } }])
  })
})

describe('settings CLI', () => {
  test('sets a dotted key as a nested patch with a JSON or string value', async () => {
    responses.set('update_settings', {
      settings: { appearance: { theme: 'light' }, editing: { snapping: { pixelGrid: false } } }
    })
    await cli(['settings', 'set', 'editing.snapping.pixelGrid', 'false'])
    const theme = await cli(['settings', 'set', 'appearance.theme', 'light'])
    expect(theme.exitCode).toBe(0)
    expect(requests).toEqual([
      {
        command: 'update_settings',
        args: { settings: { editing: { snapping: { pixelGrid: false } } } }
      },
      { command: 'update_settings', args: { settings: { appearance: { theme: 'light' } } } }
    ])
  })

  test('reads one setting by dotted key and rejects unknown keys', async () => {
    responses.set('get_settings', { settings: { appearance: { theme: 'auto' } } })
    const theme = await cli(['settings', 'get', 'appearance.theme'])
    expect(theme.stdout).toBe('auto')

    const inherited = await cli(['settings', 'get', 'appearance.constructor'])
    expect(inherited.exitCode).toBe(1)

    const missing = await cli(['settings', 'get', 'appearance.font'])
    expect(missing.exitCode).toBe(1)
    expect(missing.stderr).toContain('Unknown setting "appearance.font"')
  })
})
