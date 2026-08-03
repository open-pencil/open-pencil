import { afterEach, describe, expect, test } from 'bun:test'

import { createAppwriteStorageAdapterWithConfig } from '@/app/integrations/storage/appwrite/adapter'
import {
  appwriteFileName,
  appwriteObjectKey,
  putObject
} from '@/app/integrations/storage/appwrite/client'
import {
  normalizeAppwriteEndpoint,
  resolveAppwriteConfig,
  type AppwriteConfig
} from '@/app/integrations/storage/appwrite/config'
import type { StorageProviderRuntime } from '@/app/integrations/storage/types'

const originalFetch = globalThis.fetch

type StoredFile = {
  bytes: Uint8Array
  name: string
  updatedAt: string
}

function appwriteRuntime(
  preferences: Readonly<Record<string, string>>,
  apiKey = 'appwrite-api-key'
): StorageProviderRuntime {
  return {
    preferences,
    resolveCredential(field) {
      return Promise.resolve(field === 'api-key' ? apiKey : null)
    }
  }
}

function requestDetails(
  input: RequestInfo | URL,
  init?: RequestInit
): {
  url: URL
  method: string
  headers: Headers
  body: BodyInit | null
} {
  const request = input instanceof Request ? input : null
  return {
    url: new URL(request?.url ?? input.toString()),
    method: init?.method ?? request?.method ?? 'GET',
    headers: new Headers(init?.headers ?? request?.headers),
    body: init?.body ?? null
  }
}

function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, { status })
}

function installStorageFetch(files: Map<string, StoredFile>): void {
  globalThis.fetch = async (input, init) => {
    const { url, method, body } = requestDetails(input, init)
    const path = url.pathname
    if (path.endsWith('/storage/buckets') && method === 'GET') {
      return jsonResponse({
        total: 1,
        buckets: [{ $id: 'bucket-1', name: 'OpenPencil' }]
      })
    }

    const filesIndex = path.indexOf('/files')
    if (filesIndex < 0) return jsonResponse({ message: 'Unexpected request' }, 500)
    const suffix = path.slice(filesIndex + '/files'.length)
    if (!suffix || suffix === '/') {
      if (method === 'GET') {
        return jsonResponse({
          total: files.size,
          files: [...files.entries()].map(([id, file]) => ({
            $id: id,
            $updatedAt: file.updatedAt,
            name: file.name,
            sizeOriginal: file.bytes.byteLength
          }))
        })
      }
      if (method === 'POST' && body instanceof FormData) {
        const id = String(body.get('fileId') ?? '')
        const file = body.get('file')
        if (!(file instanceof File)) return jsonResponse({ message: 'Missing file' }, 400)
        const stored = {
          bytes: new Uint8Array(await file.arrayBuffer()),
          // Appwrite decodes percent-encoded multipart filenames before storing them.
          name: decodeURIComponent(file.name),
          updatedAt: '2026-08-02T12:00:00.000Z'
        }
        files.set(id, stored)
        return jsonResponse(
          {
            $id: id,
            $updatedAt: stored.updatedAt,
            name: stored.name,
            sizeOriginal: stored.bytes.byteLength
          },
          201
        )
      }
    }

    const parts = suffix.split('/').filter(Boolean)
    const id = parts[0] ?? ''
    const stored = files.get(id)
    if (method === 'DELETE') {
      if (!stored) return jsonResponse({ type: 'storage_file_not_found' }, 404)
      files.delete(id)
      return new Response(null, { status: 204 })
    }
    if (!stored) return jsonResponse({ type: 'storage_file_not_found' }, 404)
    if (parts[1] === 'download') return new Response(stored.bytes)
    return jsonResponse({
      $id: id,
      $updatedAt: stored.updatedAt,
      name: stored.name,
      sizeOriginal: stored.bytes.byteLength
    })
  }
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('Appwrite storage configuration', () => {
  test('round-trips object keys through Appwrite filename decoding', () => {
    const key = 'open_pencil_storage/canvases/a%2Fb with spaces.fig'
    expect(appwriteObjectKey(decodeURIComponent(appwriteFileName(key)))).toBe(key)
  })

  test('normalizes the endpoint and resolves the dedicated API key lazily', async () => {
    expect(normalizeAppwriteEndpoint('https://fra.cloud.appwrite.io/v1/')).toBe(
      'https://fra.cloud.appwrite.io/v1'
    )
    await expect(
      resolveAppwriteConfig(
        appwriteRuntime({
          endpoint: 'https://fra.cloud.appwrite.io/v1/',
          'project-id': 'project-1',
          'bucket-id': ''
        })
      )
    ).resolves.toEqual({
      endpoint: 'https://fra.cloud.appwrite.io/v1',
      projectId: 'project-1',
      bucketId: null,
      apiKey: 'appwrite-api-key'
    })
    expect(() => normalizeAppwriteEndpoint('https://example.com/api')).toThrow('end in /v1')
  })

  test('round-trips documents and sidecar metadata through Appwrite files', async () => {
    const files = new Map<string, StoredFile>()
    installStorageFetch(files)
    const config: AppwriteConfig = {
      endpoint: 'https://fra.cloud.appwrite.io/v1',
      projectId: 'project-1',
      bucketId: null,
      apiKey: 'appwrite-api-key'
    }
    const adapter = createAppwriteStorageAdapterWithConfig(() => Promise.resolve(config))

    expect(await adapter.testConnection()).toEqual({
      ok: true,
      message: 'Connected. Appwrite storage is ready.'
    })
    await adapter.putDocument('canvas-1', new Uint8Array([1, 2, 3]), {
      name: 'Appwrite canvas',
      updatedAt: '2026-08-02T12:30:00.000Z',
      sourceFormat: 'fig',
      trashedAt: null
    })

    expect(await adapter.getDocument('canvas-1')).toEqual(new Uint8Array([1, 2, 3]))
    expect(await adapter.listDocuments()).toEqual([
      {
        id: 'canvas-1',
        name: 'Appwrite canvas',
        updatedAt: '2026-08-02T12:30:00.000Z',
        sourceFormat: 'fig',
        trashedAt: null,
        metadataAuthoritative: true
      }
    ])
    expect(await adapter.getUsage()).toMatchObject({ documentCount: 1 })

    await adapter.deleteDocument('canvas-1')
    await expect(adapter.getDocument('canvas-1')).rejects.toThrow('Document not found')
  })

  test('uses Appwrite chunk headers for files larger than 5 MB', async () => {
    const calls: Array<{ contentRange: string | null; uploadId: string | null }> = []
    globalThis.fetch = async (input, init) => {
      const { method, headers } = requestDetails(input, init)
      if (method === 'DELETE') return jsonResponse({ type: 'storage_file_not_found' }, 404)
      calls.push({
        contentRange: headers.get('content-range'),
        uploadId: headers.get('x-appwrite-id')
      })
      return jsonResponse(
        {
          $id: 'chunked-file',
          $updatedAt: '2026-08-02T12:00:00.000Z',
          name: appwriteFileName('large.fig'),
          sizeOriginal: 6 * 1024 * 1024
        },
        201
      )
    }
    const config: AppwriteConfig = {
      endpoint: 'https://fra.cloud.appwrite.io/v1',
      projectId: 'project-1',
      bucketId: 'bucket-1',
      apiKey: 'appwrite-api-key'
    }

    await putObject(
      config,
      'bucket-1',
      'large.fig',
      new Uint8Array(6 * 1024 * 1024),
      'application/octet-stream'
    )

    expect(calls).toEqual([
      { contentRange: `bytes 0-${5 * 1024 * 1024 - 1}/${6 * 1024 * 1024}`, uploadId: null },
      {
        contentRange: `bytes ${5 * 1024 * 1024}-${6 * 1024 * 1024 - 1}/${6 * 1024 * 1024}`,
        uploadId: 'chunked-file'
      }
    ])
  })
})

describe('bucket resolution stays on browser-usable calls', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('an explicit bucket ID never triggers an admin bucket call', async () => {
    // listBuckets/createBucket ignore bucket permissions and require admin
    // scope, which a browser origin never has — Appwrite resolves those to the
    // `guests` role no matter what X-Appwrite-Key says. The discovery call used
    // to run before the bucketId check, so even a named bucket hit it and
    // failed with `missing scopes (["buckets.read"])`.
    const adminCalls: string[] = []
    const files = new Map<string, StoredFile>()
    installStorageFetch(files)
    const withFiles = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const { url, method } = requestDetails(input, init)
      if (url.pathname.endsWith('/storage/buckets')) {
        adminCalls.push(`${method} ${url.pathname}`)
      }
      return withFiles(input, init)
    }

    const adapter = createAppwriteStorageAdapterWithConfig(() =>
      Promise.resolve({
        endpoint: 'https://fra.cloud.appwrite.io/v1',
        projectId: 'project-1',
        bucketId: 'bucket-1',
        apiKey: 'appwrite-api-key'
      })
    )

    await adapter.listDocuments()

    expect(adminCalls).toEqual([])
  })
})
