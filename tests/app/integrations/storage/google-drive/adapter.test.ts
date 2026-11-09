import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import { StorageRevisionConflictError } from '@/app/integrations/storage/errors'
import { createGoogleDriveStorageAdapter } from '@/app/integrations/storage/google-drive/adapter'
import type { StorageAdapter } from '@/app/integrations/storage/types'

const testAuth = { token: () => Promise.resolve('test-token'), forget: () => undefined }

const recordSchema = v.record(v.string(), v.unknown())
const parseRecord = (text: string) => v.parse(v.pipe(v.string(), v.parseJson(), recordSchema), text)

interface FakeFile {
  id: string
  name: string
  mimeType: string
  parents: string[]
  modifiedTime: string
  version: number
  appProperties?: Record<string, string>
  bytes: Uint8Array
  trashed: boolean
}

/** Enough of Drive v3 for the adapter: search, multipart create/update, media download, trash. */
function fakeDrive() {
  const files = new Map<string, FakeFile>()
  let next = 1
  const authHeaders: (string | null)[] = []

  function matches(file: FakeFile, q: string): boolean {
    if (q.includes('trashed=false') && file.trashed) return false
    const mime = /mimeType='([^']+)'/.exec(q)?.[1]
    if (mime && file.mimeType !== mime) return false
    const name = /name='([^']+)'/.exec(q)?.[1]
    if (name && file.name !== name) return false
    const parent = /'([^']+)' in parents/.exec(q)?.[1]
    if (parent && !file.parents.includes(parent)) return false
    const prop = /value='([^']+)'/.exec(q)?.[1]
    if (prop && file.appProperties?.lawhaId !== prop) return false
    return true
  }

  const view = (f: FakeFile) => ({
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime,
    version: String(f.version),
    size: String(f.bytes.length),
    appProperties: f.appProperties
  })

  function parseMultipart(body: Uint8Array, contentType: string) {
    const boundary = /boundary=(.+)$/.exec(contentType)?.[1] ?? ''
    const text = new TextDecoder('latin1').decode(body)
    const parts = text.split(`--${boundary}`)
    // latin1 keeps one character per byte, so text offsets are byte offsets; the JSON is UTF-8.
    const metaStart = text.indexOf(parts[1]) + parts[1].indexOf('\r\n\r\n') + 4
    const metaEnd = text.indexOf(`--${boundary}`, metaStart)
    const meta = parseRecord(new TextDecoder().decode(body.slice(metaStart, metaEnd)).trim())
    const dataPart = parts[2]
    const start = text.indexOf(dataPart) + dataPart.indexOf('\r\n\r\n') + 4
    const end = text.lastIndexOf(`\r\n--${boundary}--`)
    return { meta, bytes: body.slice(start, end) }
  }

  const handler = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init)
    authHeaders.push(request.headers.get('authorization'))
    const url = new URL(request.url)
    const json = (data: unknown) => Response.json(data)
    if (url.pathname === '/drive/v3/files' && request.method === 'GET') {
      const q = url.searchParams.get('q') ?? ''
      return json({ files: [...files.values()].filter((f) => matches(f, q)).map(view) })
    }
    if (url.pathname === '/drive/v3/files' && request.method === 'POST') {
      const meta = parseRecord(await request.text())
      const id = `f${next++}`
      files.set(id, {
        id,
        name: meta.name,
        mimeType: meta.mimeType,
        parents: [],
        modifiedTime: new Date().toISOString(),
        version: 1,
        bytes: new Uint8Array(),
        trashed: false
      })
      return json({ id, name: meta.name })
    }
    const upload = /^\/upload\/drive\/v3\/files(?:\/([^/]+))?$/.exec(url.pathname)
    if (upload) {
      const { meta, bytes } = parseMultipart(
        new Uint8Array(await request.arrayBuffer()),
        request.headers.get('content-type') ?? ''
      )
      const existing = upload[1] ? files.get(upload[1]) : undefined
      const file: FakeFile = existing ?? {
        id: `f${next++}`,
        name: '',
        mimeType: String(meta.mimeType),
        parents: (meta.parents as string[] | undefined) ?? [],
        modifiedTime: '',
        version: 0,
        bytes,
        trashed: false
      }
      file.name = String(meta.name)
      file.modifiedTime = String(meta.modifiedTime)
      file.appProperties = meta.appProperties as Record<string, string>
      file.bytes = bytes
      file.version += 1
      files.set(file.id, file)
      return json(view(file))
    }
    const one = /^\/drive\/v3\/files\/([^/]+)$/.exec(url.pathname)
    if (one) {
      const file = files.get(one[1])
      if (!file) return new Response('', { status: 404 })
      if (url.searchParams.get('alt') === 'media') return new Response(file.bytes)
      if (request.method === 'PATCH') {
        file.trashed = parseRecord(await request.text()).trashed === true
        return json(view(file))
      }
    }
    return new Response('unhandled', { status: 500 })
  }
  return { files, handler, authHeaders }
}

const originalFetch = globalThis.fetch
let drive: ReturnType<typeof fakeDrive>
let adapter: StorageAdapter

beforeEach(() => {
  drive = fakeDrive()
  globalThis.fetch = drive.handler
  adapter = createGoogleDriveStorageAdapter(
    {
      preferences: { 'client-id': 'client.apps.googleusercontent.com', folder: 'Lawha' },
      resolveCredential: () => Promise.resolve(null),
      profileId: 'default'
    },
    testAuth
  )
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

const bytes = (...values: number[]) => new Uint8Array(values)

describe('Google Drive storage', () => {
  test('connecting creates the Lawha folder once and sends the Google token', async () => {
    expect(await adapter.testConnection()).toMatchObject({ ok: true })
    expect(await adapter.testConnection()).toMatchObject({ ok: true })
    const folders = [...drive.files.values()].filter((f) => f.mimeType.endsWith('folder'))
    expect(folders.map((f) => f.name)).toEqual(['Lawha'])
    expect(drive.authHeaders.every((h) => h === 'Bearer test-token')).toBe(true)
  })

  test('a saved document lists, opens byte for byte, and keeps its id when saved again', async () => {
    const first = await adapter.putDocument('doc-1', bytes(1, 2, 3, 0, 255, 13, 10), {
      name: 'بطاقة',
      updatedAt: '2026-11-09T10:00:00.000Z'
    })
    expect(first.revision).toBe('1')
    const list = await adapter.listDocuments()
    expect(list).toMatchObject([{ id: 'doc-1', name: 'بطاقة', revision: '1' }])
    const opened = await adapter.getDocument('doc-1')
    expect([...opened.bytes]).toEqual([1, 2, 3, 0, 255, 13, 10])

    const second = await adapter.putDocument(
      'doc-1',
      bytes(9),
      { name: 'بطاقة', updatedAt: '2026-11-09T11:00:00.000Z' },
      undefined,
      { baseRevision: '1' }
    )
    expect(second.revision).toBe('2')
    expect((await adapter.listDocuments()).length).toBe(1)
    const fig = [...drive.files.values()].find((f) => f.appProperties?.lawhaId === 'doc-1')
    expect(fig?.name).toBe('بطاقة.fig')
  })

  test('a save from an older copy is refused as a conflict', async () => {
    await adapter.putDocument('doc-2', bytes(1), {
      name: 'A',
      updatedAt: '2026-11-09T10:00:00.000Z'
    })
    await adapter.putDocument(
      'doc-2',
      bytes(2),
      { name: 'A', updatedAt: '2026-11-09T10:01:00.000Z' },
      undefined,
      { baseRevision: '1' }
    )
    expect(
      adapter.putDocument(
        'doc-2',
        bytes(3),
        { name: 'A', updatedAt: '2026-11-09T10:02:00.000Z' },
        undefined,
        { baseRevision: '1' }
      )
    ).rejects.toBeInstanceOf(StorageRevisionConflictError)
  })

  test('deleting moves the file to the trash and out of the list', async () => {
    await adapter.putDocument('doc-3', bytes(1), {
      name: 'B',
      updatedAt: '2026-11-09T10:00:00.000Z'
    })
    await adapter.deleteDocument('doc-3')
    expect(await adapter.listDocuments()).toEqual([])
    expect(
      [...drive.files.values()].find((f) => f.appProperties?.lawhaId === 'doc-3')?.trashed
    ).toBe(true)
  })

  test('usage counts the documents and their bytes', async () => {
    await adapter.putDocument('a', bytes(1, 2), {
      name: 'A',
      updatedAt: '2026-11-09T10:00:00.000Z'
    })
    await adapter.putDocument('b', bytes(1, 2, 3), {
      name: 'B',
      updatedAt: '2026-11-09T10:00:00.000Z'
    })
    expect(await adapter.getUsage()).toEqual({ bytesUsed: 5, objectCount: 2, documentCount: 2 })
  })
})
