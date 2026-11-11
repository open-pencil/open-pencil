import { describe, expect, test } from 'bun:test'

import { unzipSync } from 'fflate'

import { saveAccountArchive } from '@/app/cloud-portal/archive'
import { cloudChecksum } from '@/app/integrations/storage/cloud/download'

const ORIGIN = 'https://cloud.example.com'
const WORKSPACE = '00000000-0000-4000-8000-000000000001'

type Stored = { id: string; name: string; kind: 'design' | 'board'; bytes: Uint8Array | null }

/** A server holding `stored`: its API names each file, its object store serves the bytes. */
function server(stored: Stored[]): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString())
    const document = stored.find((candidate) => url.pathname.endsWith(candidate.id))
    if (!document) return new Response('missing', { status: 404 })
    if (url.pathname === `/objects/${document.id}`) {
      return document.bytes
        ? new Response(Uint8Array.from(document.bytes))
        : new Response('gone', { status: 404 })
    }
    if (url.pathname !== `/api/documents/${document.id}`) {
      return new Response('missing', { status: 404 })
    }
    const bytes = document.bytes ?? new Uint8Array([1])
    return Response.json({
      document: {
        document: {
          id: document.id,
          workspaceId: WORKSPACE,
          name: document.name,
          kind: document.kind,
          currentRevisionId: document.id,
          version: 1,
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z'
        },
        revisionId: document.id,
        byteSize: bytes.byteLength,
        checksum: await cloudChecksum(bytes),
        contentType: 'application/octet-stream',
        download: {
          url: `${ORIGIN}/objects/${document.id}`,
          method: 'GET',
          headers: {},
          expiresAt: '2026-11-01T01:00:00.000Z'
        },
        images: []
      }
    })
  }) as typeof fetch
}

const id = (n: number) => `00000000-0000-4000-8000-00000000010${n}`

/** A file the person picked, collecting what the archive writes into it. */
function pickedFile() {
  const chunks: Uint8Array[] = []
  const state = { closed: false, aborted: false }
  return {
    chunks,
    state,
    bytes: () => Uint8Array.from(chunks.flatMap((chunk) => [...chunk])),
    file: {
      createWritable: async () =>
        new WritableStream<Uint8Array>({
          write(chunk) {
            chunks.push(chunk)
          },
          close() {
            state.closed = true
          },
          abort() {
            state.aborted = true
          }
        })
    }
  }
}

/** How many objects `fetch` serves at once, at most. */
function counted(inner: typeof fetch) {
  let open = 0
  const counts = { most: 0 }
  const wrapped = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString()
    if (!url.includes('/objects/')) return inner(input, init)
    open++
    counts.most = Math.max(counts.most, open)
    try {
      return await inner(input, init)
    } finally {
      open--
    }
  }) as typeof fetch
  return { fetch: wrapped, counts }
}

describe('account archive', () => {
  test('saves every document it can get in one zip and names the rest', async () => {
    const stored: Stored[] = [
      { id: id(1), name: 'Plan', kind: 'design', bytes: new Uint8Array([1, 2, 3]) },
      { id: id(2), name: 'Plan', kind: 'design', bytes: new Uint8Array([4, 5]) },
      { id: id(3), name: 'Retro', kind: 'board', bytes: new Uint8Array([6]) },
      { id: id(4), name: 'Lost', kind: 'design', bytes: null }
    ]
    const saved: Array<{ name: string; bytes: Uint8Array }> = []
    const progress: number[] = []
    const result = await saveAccountArchive(
      stored.map((document) => ({ id: document.id, name: document.name, workspaceName: 'Solo' })),
      {
        apiURL: `${ORIGIN}/api`,
        archiveName: 'Files.zip',
        fetch: server(stored),
        save: (bytes, name) => saved.push({ name, bytes }),
        onProgress: ({ done }) => progress.push(done)
      }
    )

    expect(result?.saved).toBe(3)
    expect(result?.failed.map((document) => document.name)).toEqual(['Lost'])
    expect(progress.at(-1)).toBe(4)
    expect(saved.map((file) => file.name)).toEqual(['Files.zip'])
    const entries = unzipSync(saved[0]?.bytes ?? new Uint8Array())
    expect(Object.keys(entries).toSorted()).toEqual(['Plan (2).fig', 'Plan.fig', 'Retro.jam'])
    expect([...(entries['Retro.jam'] ?? [])]).toEqual([6])
  })

  test('writes into the picked file one document at a time, numbering repeated names', async () => {
    const stored: Stored[] = [
      { id: id(1), name: 'Plan', kind: 'design', bytes: new Uint8Array([1, 2, 3]) },
      { id: id(2), name: 'Plan', kind: 'design', bytes: new Uint8Array([4, 5]) },
      { id: id(3), name: 'Lost', kind: 'design', bytes: null },
      { id: id(4), name: 'Retro', kind: 'board', bytes: new Uint8Array([6]) }
    ]
    const picked = pickedFile()
    const { fetch, counts } = counted(server(stored))
    const saved: string[] = []
    const result = await saveAccountArchive(
      stored.map((document) => ({ id: document.id, name: document.name, workspaceName: 'Solo' })),
      {
        apiURL: `${ORIGIN}/api`,
        archiveName: 'Files.zip',
        fetch,
        save: (_bytes, name) => saved.push(name),
        pickFile: async () => picked.file
      }
    )

    expect(result?.saved).toBe(3)
    expect(result?.failed.map((document) => document.name)).toEqual(['Lost'])
    // Nothing is built in memory to save afterwards, and objects arrive one by one.
    expect(saved).toEqual([])
    expect(counts.most).toBe(1)
    const entries = unzipSync(picked.bytes())
    expect(Object.keys(entries)).toEqual(['Plan.fig', 'Plan (2).fig', 'Retro.jam'])
    expect([...(entries['Plan (2).fig'] ?? [])]).toEqual([4, 5])
  })

  test('saves nothing and reports nothing when the person cancels the picker', async () => {
    let fetched = 0
    const result = await saveAccountArchive([{ id: id(1), name: 'Plan', workspaceName: 'Solo' }], {
      apiURL: `${ORIGIN}/api`,
      archiveName: 'Files.zip',
      fetch: (async (_input: string | URL | Request) => {
        fetched++
        return new Response('unused')
      }) as typeof fetch,
      pickFile: () => Promise.reject(new DOMException('The user aborted a request.', 'AbortError'))
    })
    expect(result).toBeNull()
    expect(fetched).toBe(0)
  })

  test('builds the zip in memory when the browser refuses to write the picked file', async () => {
    const stored: Stored[] = [
      { id: id(1), name: 'Plan', kind: 'design', bytes: new Uint8Array([1]) }
    ]
    const saved: string[] = []
    const result = await saveAccountArchive([{ id: id(1), name: 'Plan', workspaceName: 'Solo' }], {
      apiURL: `${ORIGIN}/api`,
      archiveName: 'Files.zip',
      fetch: server(stored),
      save: (_bytes, name) => saved.push(name),
      pickFile: async () => ({
        createWritable: () => Promise.reject(new DOMException('Refused', 'NotAllowedError'))
      })
    })
    expect(result?.saved).toBe(1)
    expect(saved).toEqual(['Files.zip'])
  })

  test('saves nothing when no document arrives', async () => {
    const saved: string[] = []
    const result = await saveAccountArchive([{ id: id(1), name: 'Lost', workspaceName: 'Solo' }], {
      apiURL: `${ORIGIN}/api`,
      archiveName: 'Files.zip',
      fetch: server([{ id: id(1), name: 'Lost', kind: 'design', bytes: null }]),
      save: (_bytes, name) => saved.push(name)
    })
    expect(result).toEqual({
      saved: 0,
      failed: [{ id: id(1), name: 'Lost', workspaceName: 'Solo' }]
    })
    expect(saved).toEqual([])
  })

  test('aborts the picked file instead of writing an empty zip when no document arrives', async () => {
    const picked = pickedFile()
    const result = await saveAccountArchive([{ id: id(1), name: 'Lost', workspaceName: 'Solo' }], {
      apiURL: `${ORIGIN}/api`,
      archiveName: 'Files.zip',
      fetch: server([{ id: id(1), name: 'Lost', kind: 'design', bytes: null }]),
      pickFile: async () => picked.file
    })
    expect(result?.saved).toBe(0)
    expect(result?.failed.map((document) => document.name)).toEqual(['Lost'])
    expect(picked.state).toEqual({ closed: false, aborted: true })
  })
})
