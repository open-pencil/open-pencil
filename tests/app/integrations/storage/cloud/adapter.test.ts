import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
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
  type Image = { name: string; checksum: string }
  type Doc = {
    name: string
    revision: string | null
    version: number
    checksum?: string
    images?: Image[]
  }
  const documents = new Map<string, Doc>()
  const objects = new Map<string, Uint8Array>()
  let fullReads = 0
  let cancelledReads = 0
  /**
   * How the object store answers a range: as asked, by ignoring it, with more or fewer bytes
   * than asked and no `Content-Range` to tell, or with another range than asked.
   */
  let ranges: 'honored' | 'ignored' | 'oversized' | 'short' | 'other' = 'honored'
  const uploads = new Map<string, { documentId: string; base: string | null; image?: string }>()
  /** The workspace's images by checksum, as the object key their upload put them under. */
  const images = new Map<string, string>()
  const imageUploads: string[] = []
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
      /^\/documents\/([^/]+)\/images$/,
      ([, documentId = ''], body) => {
        const requested = Array.isArray(body.images) ? body.images : []
        const offers = requested.flatMap((image: { checksum: string }) => {
          if (images.has(image.checksum)) return []
          const uploadId = crypto.randomUUID()
          uploads.set(uploadId, { documentId, base: null, image: image.checksum })
          imageUploads.push(image.checksum)
          return [
            {
              checksum: image.checksum,
              uploadId,
              upload: {
                kind: 'single',
                url: `https://objects.test/${uploadId}`,
                method: 'PUT',
                headers: {},
                expiresAt: '2030-01-01T00:00:00.000Z'
              }
            }
          ]
        })
        return json({ uploads: offers }, 201)
      }
    ],
    [
      'POST',
      /^\/documents\/([^/]+)\/images\/commit$/,
      (_match, body) => {
        const committed = (Array.isArray(body.uploads) ? body.uploads : []) as {
          uploadId: string
        }[]
        for (const { uploadId } of committed) {
          const image = uploads.get(uploadId)?.image
          if (image) images.set(image, uploadId)
        }
        return new Response(null, { status: 204 })
      }
    ],
    [
      'POST',
      /^\/uploads\/([^/]+)\/commit$/,
      ([, uploadId = ''], body) => {
        const upload = uploads.get(uploadId)
        const doc = upload ? documents.get(upload.documentId) : undefined
        if (!upload || !doc) return json({ error: { code: 'not_found' } }, 404)
        const named = (Array.isArray(body.images) ? body.images : []) as Image[]
        if (named.some((image) => !images.has(image.checksum))) {
          return json({ error: { code: 'invalid_upload' } }, 422)
        }
        if (doc.revision !== upload.base) return json({ error: { code: 'revision_conflict' } }, 409)
        const revision = crypto.randomUUID()
        objects.set(revision, objects.get(uploadId) ?? new Uint8Array())
        Object.assign(doc, {
          revision,
          version: doc.version + 1,
          checksum: String(body.checksum),
          images: named
        })
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
            download: { ...download, expiresAt: '2030-01-01T00:00:00.000Z' },
            images: (doc.images ?? []).map((image) => {
              const key = images.get(image.checksum) ?? ''
              return {
                ...image,
                byteSize: objects.get(key)?.byteLength ?? 0,
                download: {
                  url: `https://objects.test/${key}`,
                  method: 'GET',
                  headers: {},
                  expiresAt: '2030-01-01T00:00:00.000Z'
                }
              }
            })
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
    if (!bytes) return new Response(null, { status: 404 })
    const range = /^bytes=(\d+)-(\d+)$/.exec(new Headers(init.headers).get('Range') ?? '')
    if (!range) {
      fullReads += 1
      return new Response(Uint8Array.from(bytes))
    }
    const [, first = '0', last = '0'] = range
    const start = Number(first)
    const end = Number(last) + 1
    // A chunk at a time, so a reader can stop it partway.
    const streamed = (from: number, to: number) => {
      let offset = from
      return new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(bytes.slice(offset, Math.min(offset + 1024, to)))
          offset += 1024
          if (offset >= to) controller.close()
        },
        cancel() {
          cancelledReads += 1
        }
      })
    }
    if (ranges === 'ignored') {
      fullReads += 1
      return new Response(streamed(0, bytes.byteLength))
    }
    const sent = {
      honored: [start, end],
      oversized: [start, bytes.byteLength],
      short: [start, end - 1],
      other: [start + 1, end + 1]
    }[ranges]
    const [from = start, to = end] = sent
    // A store whose CORS rules hide `Content-Range` leaves only the body's length to go by.
    const headers: Record<string, string> =
      ranges === 'oversized' || ranges === 'short'
        ? {}
        : { 'Content-Range': `bytes ${from}-${to - 1}/${bytes.byteLength}` }
    return new Response(streamed(from, to), { status: 206, headers })
  }

  /** Someone else saves the document, moving its revision on. */
  function saveElsewhere(id: string) {
    const doc = documents.get(id)
    if (doc) doc.revision = crypto.randomUUID()
  }

  const client = createCloudAPIClient('https://cloud.test/api', { fetch: api })
  return {
    client,
    objectFetch,
    saveElsewhere,
    objects,
    /** The checksums of every image an upload was offered for. */
    imageUploads,
    fullReads: () => fullReads,
    cancelledReads: () => cancelledReads,
    answerRanges(answer: typeof ranges) {
      ranges = answer
    }
  }
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

  test('stores a file without its images, uploads only images it lacks, and opens it whole', async () => {
    const server = cloudServer()
    const storage = adapter(server)
    const photo = crypto.getRandomValues(new Uint8Array(4096))
    const logo = crypto.getRandomValues(new Uint8Array(512))
    const archive = (pages: string) =>
      zipSync({
        'canvas.fig': strToU8(pages),
        'meta.json': strToU8('{}'),
        'images/a1b2': photo,
        'images/c3d4': logo,
        // Cloud stores apart only names it accepts; this one stays inside the file.
        'images/old name.png': logo,
        // Nor does an empty image, which the server refuses to store.
        'images/e5f6': new Uint8Array()
      })
    const first = crypto.randomUUID()
    const saved = await storage.putDocument(first, archive('first'), { name: 'A', updatedAt: '' })
    const stored = saved.revision ? server.objects.get(saved.revision) : undefined
    if (!stored) throw new Error('Expected the stored file')
    expect(Object.keys(unzipSync(stored)).sort()).toEqual([
      'canvas.fig',
      'images/e5f6',
      'images/old name.png',
      'meta.json'
    ])
    expect(server.imageUploads).toHaveLength(2)

    // Another document with the same images uploads neither.
    await storage.putDocument(crypto.randomUUID(), archive('second'), { name: 'B', updatedAt: '' })
    expect(server.imageUploads).toHaveLength(2)

    const opened = unzipSync((await storage.getDocument(first)).bytes)
    expect(strFromU8(opened['canvas.fig'] ?? new Uint8Array())).toBe('first')
    expect(opened['images/a1b2']).toEqual(photo)
    expect(opened['images/c3d4']).toEqual(logo)
    expect(opened['images/old name.png']).toEqual(logo)
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

  test('reads a document’s preview without downloading the whole file', async () => {
    const server = cloudServer()
    const storage = adapter(server)
    const id = crypto.randomUUID()
    const figBytes = new Uint8Array(readFileSync('tests/fixtures/gold-preview.fig'))
    await storage.putDocument(id, figBytes, { name: 'Preview', updatedAt: '' })
    const thumbnail = await storage.getThumbnail?.(id)
    expect(thumbnail?.subarray(0, 8)).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
    expect(server.fullReads()).toBe(0)
  })

  test('gives up on a preview when the object store sends the whole file', async () => {
    const server = cloudServer()
    const storage = adapter(server)
    const id = crypto.randomUUID()
    const figBytes = new Uint8Array(readFileSync('tests/fixtures/gold-preview.fig'))
    await storage.putDocument(id, figBytes, { name: 'Preview', updatedAt: '' })
    server.answerRanges('ignored')
    await expect(storage.getThumbnail?.(id) ?? Promise.resolve()).rejects.toThrow('HTTP 200')
    expect(server.cancelledReads()).toBe(1)
  })

  test('takes only the range it asked for, stopping one that runs on', async () => {
    const server = cloudServer()
    const storage = adapter(server)
    const id = crypto.randomUUID()
    const figBytes = new Uint8Array(readFileSync('tests/fixtures/gold-preview.fig'))
    await storage.putDocument(id, figBytes, { name: 'Preview', updatedAt: '' })
    const preview = () => storage.getThumbnail?.(id) ?? Promise.resolve()

    server.answerRanges('oversized')
    await expect(preview()).rejects.toThrow('more than')
    expect(server.cancelledReads()).toBeGreaterThan(0)
    server.answerRanges('short')
    await expect(preview()).rejects.toThrow('sent')
    server.answerRanges('other')
    await expect(preview()).rejects.toThrow('HTTP 206 (bytes')
  })
})
