import { describe, expect, test } from 'bun:test'

import { fromUint8Array } from 'js-base64'

import { createCloudAPIClient } from '@open-pencil/cloud/client'

import { StorageRevisionConflictError } from '@/app/integrations/storage'
import { createCloudStorageAdapter } from '@/app/integrations/storage/cloud/adapter'

const WORKSPACE = '0b5a4e0a-2d1c-4d6e-9f1a-6b2c3d4e5f60'

async function sha256(bytes: Uint8Array): Promise<string> {
  return fromUint8Array(
    new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)))
  )
}

/** Just enough of a Cloud server and its object store to save and open documents. */
function cloudServer() {
  type Doc = { name: string; revision: string | null; version: number; checksum?: string }
  const documents = new Map<string, Doc>()
  const objects = new Map<string, Uint8Array>()
  const uploads = new Map<string, { documentId: string; base: string | null }>()
  const summary = (id: string, doc: Doc) => ({
    id,
    workspaceId: WORKSPACE,
    name: doc.name,
    currentRevisionId: doc.revision,
    version: doc.version,
    createdAt: '2026-10-10T00:00:00.000Z',
    updatedAt: '2026-10-10T00:00:00.000Z'
  })
  const json = (body: unknown, status = 200) => Response.json(body, { status })

  type Body = Record<string, unknown>
  type Route = [
    method: string,
    path: RegExp,
    handle: (match: string[], body: Body) => Promise<Response> | Response
  ]
  const documentsPath = new RegExp(`^/workspaces/${WORKSPACE}/documents$`)
  const routes: Route[] = [
    [
      'GET',
      documentsPath,
      () => json({ documents: [...documents].map(([id, doc]) => summary(id, doc)) })
    ],
    [
      'POST',
      documentsPath,
      (_match, body) => {
        const id = String(body.id)
        const doc = { name: String(body.name), revision: null, version: 0 }
        documents.set(id, doc)
        return json({ document: summary(id, doc) }, 201)
      }
    ],
    [
      'POST',
      /^\/documents\/([^/]+)\/uploads$/,
      ([, documentId = ''], body) => {
        const base = typeof body.baseRevisionId === 'string' ? body.baseRevisionId : null
        if ((documents.get(documentId)?.revision ?? null) !== base) {
          return json({ error: { code: 'revision_conflict' } }, 409)
        }
        const id = crypto.randomUUID()
        uploads.set(id, { documentId, base })
        const upload = {
          kind: 'single',
          url: `https://objects.test/${id}`,
          method: 'PUT',
          headers: {}
        }
        return json({ id, upload: { ...upload, expiresAt: '2030-01-01T00:00:00.000Z' } }, 201)
      }
    ],
    [
      'POST',
      /^\/uploads\/([^/]+)\/commit$/,
      ([, uploadId = ''], body) => {
        const upload = uploads.get(uploadId)
        const doc = upload ? documents.get(upload.documentId) : undefined
        if (!upload || !doc) return json({ error: { code: 'not_found' } }, 404)
        if (doc.revision !== upload.base) return json({ error: { code: 'revision_conflict' } }, 409)
        const revision = crypto.randomUUID()
        objects.set(revision, objects.get(uploadId) ?? new Uint8Array())
        Object.assign(doc, { revision, version: doc.version + 1, checksum: String(body.checksum) })
        return json({ document: summary(upload.documentId, doc) })
      }
    ],
    [
      'GET',
      /^\/documents\/([^/]+)$/,
      async ([, id = '']) => {
        const doc = documents.get(id)
        const bytes = doc?.revision ? objects.get(doc.revision) : undefined
        if (!doc?.revision || !bytes) return json({ error: { code: 'not_found' } }, 404)
        const download = { url: `https://objects.test/${doc.revision}`, method: 'GET', headers: {} }
        return json({
          document: {
            document: summary(id, doc),
            revisionId: doc.revision,
            byteSize: bytes.byteLength,
            checksum: doc.checksum ?? (await sha256(bytes)),
            contentType: 'application/octet-stream',
            download: { ...download, expiresAt: '2030-01-01T00:00:00.000Z' }
          }
        })
      }
    ]
  ]

  async function api(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = new Request(input, init)
    const path = new URL(request.url).pathname.replace(/^\/api/, '')
    const body: Body = request.method === 'POST' ? await request.json() : {}
    for (const [method, pattern, handle] of routes) {
      const match = request.method === method ? path.match(pattern) : null
      if (match) return handle([...match], body)
    }
    return json({ error: { code: 'not_found' } }, 404)
  }

  async function objectFetch(input: string, init: RequestInit): Promise<Response> {
    const key = new URL(input).pathname.slice(1)
    if (init.method === 'PUT') {
      objects.set(key, new Uint8Array(await new Response(init.body).arrayBuffer()))
      return new Response(null, { status: 200 })
    }
    const bytes = objects.get(key)
    return bytes ? new Response(Uint8Array.from(bytes)) : new Response(null, { status: 404 })
  }

  /** Someone else saves the document, moving its revision on. */
  function saveElsewhere(id: string) {
    const doc = documents.get(id)
    if (doc) doc.revision = crypto.randomUUID()
  }

  const client = createCloudAPIClient('https://cloud.test/api', { fetch: api })
  return { client, objectFetch, saveElsewhere, objects }
}

function adapter(server: ReturnType<typeof cloudServer>) {
  return createCloudStorageAdapter(
    {
      preferences: {},
      resolveCredential: async () => null,
      profileId: 'server',
      containerId: WORKSPACE
    },
    { client: async () => server.client, objectFetch: server.objectFetch }
  )
}

describe('Cloud storage adapter', () => {
  test('creates the document on its first save and opens what it saved', async () => {
    const server = cloudServer()
    const storage = adapter(server)
    const id = crypto.randomUUID()
    const bytes = new TextEncoder().encode('design')
    const saved = await storage.putDocument(id, bytes, { name: 'Landing page', updatedAt: '' })
    expect(saved.revision).toBeString()
    expect((await storage.listDocuments()).map((document) => document.name)).toEqual([
      'Landing page'
    ])
    const opened = await storage.getDocument(id)
    expect(new TextDecoder().decode(opened.bytes)).toBe('design')
    expect(opened.revision).toBe(saved.revision)
  })

  test('saves on top of the revision it was edited from', async () => {
    const server = cloudServer()
    const storage = adapter(server)
    const id = crypto.randomUUID()
    const first = await storage.putDocument(id, new Uint8Array([1]), { name: 'Doc', updatedAt: '' })
    const second = await storage.putDocument(
      id,
      new Uint8Array([2]),
      { name: 'Doc', updatedAt: '' },
      undefined,
      {
        baseRevision: first.revision
      }
    )
    expect(second.revision).not.toBe(first.revision)
  })

  test('refuses a save based on a revision someone else replaced', async () => {
    const server = cloudServer()
    const storage = adapter(server)
    const id = crypto.randomUUID()
    const first = await storage.putDocument(id, new Uint8Array([1]), { name: 'Doc', updatedAt: '' })
    server.saveElsewhere(id)
    const stale = storage.putDocument(
      id,
      new Uint8Array([3]),
      { name: 'Doc', updatedAt: '' },
      undefined,
      {
        baseRevision: first.revision
      }
    )
    await expect(stale).rejects.toBeInstanceOf(StorageRevisionConflictError)
  })

  test('rejects bytes that do not match what the server stored', async () => {
    const server = cloudServer()
    const storage = adapter(server)
    const id = crypto.randomUUID()
    const saved = await storage.putDocument(id, new Uint8Array([1, 2, 3]), {
      name: 'Doc',
      updatedAt: ''
    })
    server.objects.set(saved.revision ?? '', new Uint8Array([9, 9, 9]))
    await expect(storage.getDocument(id)).rejects.toThrow('does not match')
  })
})
