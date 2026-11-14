import { describe, expect, test } from 'bun:test'

import { publishExample, sameImages, type GalleryClient } from '#cloud-examples/gallery'
import { strToU8, zipSync } from 'fflate'

import type { DocumentSummary, DocumentVersion } from '@open-pencil/cloud/contract'

const WORKSPACE = '0f6b1c1e-6a8e-4b8e-9a4f-3c2d1e0f9a8b'
const NOW = '2026-11-13T00:00:00.000Z'

/** An example file; the same label gives the same contents, whenever it is zipped. */
function file(label: string): Uint8Array {
  return zipSync({ 'canvas.fig': strToU8(label), 'meta.json': strToU8('{}') })
}

const download = (url: string) => ({ url, method: 'GET' as const, headers: {}, expiresAt: NOW })

/**
 * A Cloud server holding one workspace in memory, with its object store: a save keeps what was
 * put, a download hands it back, and naming a version records its name, as the server would.
 */
function fakeCloud() {
  const documents: DocumentSummary[] = []
  const stored = new Map<string, { url: string; checksum: string }>()
  const objects = new Map<string, Uint8Array>()
  const versions = new Map<string, DocumentVersion[]>()
  const pending = new Map<string, string>()
  const calls: string[] = []
  const summary = (id: string) => {
    const document = documents.find((entry) => entry.id === id)
    if (!document) throw new Error(`No document ${id}`)
    return document
  }
  const cloud: GalleryClient = {
    async listDocuments() {
      return documents.map((document) => ({ ...document }))
    },
    async createDocument(workspaceId, input) {
      calls.push('create')
      const document: DocumentSummary = {
        id: crypto.randomUUID(),
        workspaceId,
        name: input.name,
        kind: input.kind ?? 'design',
        currentRevisionId: null,
        version: 0,
        createdAt: NOW,
        updatedAt: NOW
      }
      documents.push(document)
      return { ...document }
    },
    async getDocument(documentId) {
      const document = summary(documentId)
      const file = stored.get(documentId)
      if (!document.currentRevisionId || !file) throw new Error('Never saved')
      return {
        document: { ...document },
        revisionId: document.currentRevisionId,
        byteSize: 1,
        checksum: file.checksum,
        contentType: 'application/octet-stream',
        download: download(file.url),
        images: []
      }
    },
    async listDocumentVersions(documentId) {
      return { versions: versions.get(documentId) ?? [], nextCursor: null }
    },
    async saveDocumentVersion(documentId, input) {
      calls.push(`name ${input.name}`)
      const document = summary(documentId)
      const version: DocumentVersion = {
        id: crypto.randomUUID(),
        revisionId: document.currentRevisionId ?? crypto.randomUUID(),
        kind: 'named',
        name: input.name,
        description: input.description,
        createdAt: NOW,
        createdBy: { id: 'admin', name: 'Admin' },
        restoredFromVersionId: null,
        current: true
      }
      versions.set(documentId, [version, ...(versions.get(documentId) ?? [])])
      return version
    },
    async requestImageUploads() {
      return []
    },
    commitImageUploads: () => Promise.resolve(),
    async createUpload(documentId, input) {
      const document = summary(documentId)
      if (input.baseRevisionId !== document.currentRevisionId) throw new Error('Stale base')
      const id = crypto.randomUUID()
      pending.set(id, documentId)
      return {
        id,
        upload: {
          kind: 'single',
          url: `https://store.example/${id}`,
          method: 'PUT',
          headers: {},
          expiresAt: NOW
        }
      }
    },
    async commitUpload(uploadId, input) {
      calls.push('upload')
      const documentId = pending.get(uploadId)
      if (!documentId) throw new Error('Unknown upload')
      const document = summary(documentId)
      document.currentRevisionId = crypto.randomUUID()
      document.version++
      stored.set(documentId, { url: `https://store.example/${uploadId}`, checksum: input.checksum })
      return { ...document }
    }
  }
  const objectFetch = async (url: string, init: RequestInit) => {
    if (init.method === 'PUT') {
      objects.set(url, new Uint8Array(await new Response(init.body).arrayBuffer()))
      return new Response(null, { status: 200 })
    }
    const bytes = objects.get(url)
    return bytes ? new Response(Uint8Array.from(bytes)) : new Response(null, { status: 404 })
  }
  const publish = (
    name: string,
    bytes: Uint8Array,
    release?: { name: string; description: string }
  ) => publishExample({ cloud, workspaceId: WORKSPACE, name, bytes, release, objectFetch })
  return { cloud, documents, calls, publish }
}

describe('publishing a gallery example', () => {
  test('creates the document on its first run and saves the file', async () => {
    const server = fakeCloud()
    const outcome = await server.publish('Welcome tour', file('first'))
    expect(outcome).toMatchObject({ created: true, uploaded: true, version: null })
    expect(server.documents.map((document) => document.name)).toEqual(['Welcome tour'])
    expect(server.calls).toEqual(['create', 'upload'])
  })

  test('saves nothing when the file is unchanged, and a new revision when it changed', async () => {
    const server = fakeCloud()
    await server.publish('Tour', file('first'))
    // Zipped again, so the archive's bytes differ while what it holds does not.
    await Bun.sleep(2100)
    expect(await server.publish('Tour', file('first'))).toMatchObject({ uploaded: false })
    expect(await server.publish('Tour', file('second'))).toMatchObject({ uploaded: true })
    expect(server.calls).toEqual(['create', 'upload', 'upload'])
  })

  test('names a release once, however often it runs', async () => {
    const server = fakeCloud()
    const release = { name: '0.17.0', description: 'The tour as of 0.17.0' }
    expect((await server.publish('Tour', file('first'), release)).version).toBe('named')
    expect((await server.publish('Tour', file('first'), release)).version).toBe('existing')
    expect(server.calls.filter((call) => call.startsWith('name'))).toEqual(['name 0.17.0'])
  })

  test('refuses to choose between documents that share the example’s name', async () => {
    const server = fakeCloud()
    await server.cloud.createDocument(WORKSPACE, { name: 'Tour' })
    await server.cloud.createDocument(WORKSPACE, { name: 'Tour' })
    const refused = await server.publish('Tour', file('x')).catch(String)
    expect(refused).toContain('2 documents named "Tour"')
  })

  test('tells images that swapped contents apart', () => {
    const a = { name: 'a.png', checksum: 'one' }
    const b = { name: 'b.png', checksum: 'two' }
    expect(sameImages([a, b], [b, a])).toBe(true)
    expect(
      sameImages(
        [a, b],
        [
          { name: 'a.png', checksum: 'two' },
          { name: 'b.png', checksum: 'one' }
        ]
      )
    ).toBe(false)
  })
})
