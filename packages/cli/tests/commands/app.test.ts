import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  setDefaultTimeout,
  test
} from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { runCLI } from '#cli-tests/helpers/run'
import * as v from 'valibot'

setDefaultTimeout(60_000)

const TOKEN = 'cli-app-test-token'
const TARGET = {
  documentId: 'doc-2',
  documentName: 'Landing',
  pageId: '0:1',
  pageName: 'Page 1'
}

const requestSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({ command: v.string(), args: v.record(v.string(), v.unknown()) })
)

type Request = v.InferOutput<typeof requestSchema>

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
      const parsed = v.parse(requestSchema, body)
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

const cli = (args: string[]) =>
  runCLI(args, { env: { OPENPENCIL_MCP_DISCOVERY_PATH: discoveryPath } })

describe('documents CLI', () => {
  test('opens files by absolute path and reports the target document', async () => {
    const opened = await cli(['documents', 'open', 'designs/landing.fig', '--json'])
    expect(opened.exitCode).toBe(0)
    expect(requests).toEqual([
      { command: 'open_document', args: { path: resolve('designs/landing.fig') } }
    ])
    expect(JSON.parse(opened.stdout)).toEqual({ result: {}, target: TARGET })
  })

  test('saves, closes, and activates a targeted document', async () => {
    await cli(['documents', 'save', '--document-id', 'doc-2', '--path', 'out.fig'])
    await cli(['documents', 'close', '--document-id', 'doc-2', '--discard'])
    await cli(['documents', 'activate', 'doc-2', '--page-id', '0:1'])
    expect(requests).toEqual([
      { command: 'save_document', args: { document_id: 'doc-2', path: resolve('out.fig') } },
      { command: 'close_document', args: { document_id: 'doc-2', unsaved: 'discard' } },
      { command: 'activate_document', args: { document_id: 'doc-2', page_id: '0:1' } }
    ])
  })

  test('close --save forwards the save choice and an absolute path', async () => {
    await cli(['documents', 'close', '--save', '--path', 'draft.fig'])
    expect(requests).toEqual([
      { command: 'close_document', args: { unsaved: 'save', path: resolve('draft.fig') } }
    ])
    const both = await cli(['documents', 'close', '--save', '--discard'])
    expect(both.exitCode).toBe(1)
  })
})

describe('--page and --page-id', () => {
  const documents = [
    {
      id: 'doc-2',
      name: 'Landing',
      active: true,
      current_page_id: '0:1',
      current_page_name: 'Page 1',
      pages: [
        { id: '0:1', name: 'Page 1' },
        { id: '0:2', name: 'Worklist' }
      ]
    }
  ]

  test('a page name reaches the app as the page ID, for reads, scripts, and tools alike', async () => {
    responses.set('list_documents', { documents })
    responses.set('tree', { page: { id: '0:2', name: 'Worklist', type: 'CANVAS' }, children: [] })
    await cli(['tree', '--page', 'Worklist'])
    await cli(['eval', '--page', 'Worklist', '-c', 'return 1'])
    await cli(['tool', 'call', 'get_selection', '--page', 'Worklist'])
    expect(requests.filter((request) => request.command !== 'list_documents')).toEqual([
      { command: 'tree', args: { page_id: '0:2' } },
      { command: 'eval', args: { code: 'return 1', page_id: '0:2' } },
      { command: 'tool', args: { page_id: '0:2', name: 'get_selection', args: {} } }
    ])
  })

  test('cannot be passed together', async () => {
    const both = await cli(['find', '--page', 'Worklist', '--page-id', '0:2'])
    expect(both.exitCode).toBe(1)
    expect(both.stderr).toContain('--page and --page-id cannot be used together.')
    expect(requests).toEqual([])
  })
})

describe('history CLI', () => {
  test('reports the undone change', async () => {
    responses.set('undo', { applied: true, label: 'Agent: update_node' })
    const undone = await cli(['undo', '--document-id', 'doc-2'])
    expect(undone.exitCode).toBe(0)
    expect(undone.stdout).toContain('Undid: Agent: update_node')
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
