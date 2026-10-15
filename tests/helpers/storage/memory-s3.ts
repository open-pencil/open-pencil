import type { S3CompatibleConfig } from '@/app/integrations/storage/s3/types'

import { fetchStub } from '#tests/helpers/fetch'

export type RecordedS3Request = {
  method: string
  key: string
  ifMatch: string | null
  range: string | null
}

export type MemoryS3 = {
  objects: Map<string, Uint8Array>
  requests: RecordedS3Request[]
  /** Fail the next PUT whose key contains the marker, once, with `status`. */
  failOnce: (keyMarker: string, status?: number) => void
  /** Age or rejuvenate an object for garbage collection safety-window assertions. */
  setLastModified: (key: string, iso: string) => void
  /** Write an object directly, as another client would. */
  seed: (key: string, body: Uint8Array | string) => void
  /** Runs before each PUT is stored, e.g. to change local state while an upload is in flight. */
  beforePut: ((key: string) => Promise<void> | void) | null
  /** Restore the fetch this helper replaced. */
  restore: () => void
}

export const MEMORY_S3_CONFIG: S3CompatibleConfig = {
  endpoint: 'https://s3.example.test',
  bucket: 'bucket-1',
  accessKeyId: 'key-id',
  secretAccessKey: 'secret',
  region: 'auto'
}

const DEFAULT_LAST_MODIFIED = '2026-08-04T00:00:00.000Z'

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(`<Error><Code>${code}</Code><Message>${message}</Message></Error>`, {
    status,
    headers: { 'content-type': 'application/xml' }
  })
}

function escapeXML(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/**
 * An in-memory bucket behind the global `fetch`, speaking enough S3 for the AWS SDK client the
 * app uses: PUT (with If-Match), GET (with Range), HEAD, DELETE, and ListObjectsV2. It reads the
 * signed `Request` objects the SDK sends, so the adapter runs unmodified.
 */
export function installMemoryS3(
  config: S3CompatibleConfig = MEMORY_S3_CONFIG,
  options: { weakEtags?: boolean } = {}
): MemoryS3 {
  const originalFetch = globalThis.fetch
  const objects = new Map<string, Uint8Array>()
  const etags = new Map<string, string>()
  const lastModified = new Map<string, string>()
  const requests: RecordedS3Request[] = []
  const failOnceMarkers: { marker: string; status: number }[] = []
  let etagCounter = 0

  function store(key: string, body: Uint8Array): string {
    objects.set(key, body)
    etagCounter += 1
    const etag = `${options.weakEtags ? 'W/' : ''}"etag-${etagCounter}"`
    etags.set(key, etag)
    return etag
  }

  function list(url: URL): Response {
    const prefix = url.searchParams.get('prefix') ?? ''
    const contents = [...objects.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(
        ([key, body]) =>
          `<Contents><Key>${escapeXML(key)}</Key><LastModified>${lastModified.get(key) ?? DEFAULT_LAST_MODIFIED}</LastModified><Size>${body.byteLength}</Size></Contents>`
      )
      .join('')
    return new Response(
      `<ListBucketResult><IsTruncated>false</IsTruncated>${contents}</ListBucketResult>`,
      { status: 200, headers: { 'content-type': 'application/xml' } }
    )
  }

  function read(key: string, method: string, range: string | null): Response {
    const body = objects.get(key)
    if (!body) {
      return method === 'HEAD'
        ? new Response(null, { status: 404 })
        : errorResponse(404, 'NoSuchKey', 'missing')
    }
    const headers: Record<string, string> = { etag: etags.get(key) ?? '"none"' }
    if (method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: { ...headers, 'content-length': String(body.byteLength) }
      })
    }
    const match = range?.match(/^bytes=(\d+)-(\d+)$/)
    if (match) {
      const start = Number(match[1])
      const end = Math.min(Number(match[2]), body.byteLength - 1)
      return new Response(body.slice(start, end + 1), {
        status: 206,
        headers: { ...headers, 'content-range': `bytes ${start}-${end}/${body.byteLength}` }
      })
    }
    return new Response(body.slice(), {
      status: 200,
      headers: { ...headers, 'content-length': String(body.byteLength) }
    })
  }

  async function write(key: string, request: Request, ifMatch: string | null): Promise<Response> {
    await bucket.beforePut?.(key)
    const marker = failOnceMarkers.findIndex((fail) => key.includes(fail.marker))
    if (marker !== -1) {
      const status = failOnceMarkers[marker]?.status ?? 500
      failOnceMarkers.splice(marker, 1)
      return errorResponse(status, status === 412 ? 'PreconditionFailed' : 'InternalError', 'x')
    }
    if (ifMatch !== null && etags.get(key) !== ifMatch) {
      return errorResponse(412, 'PreconditionFailed', 'if-match mismatch')
    }
    const etag = store(key, new Uint8Array(await request.arrayBuffer()))
    return new Response('', { status: 200, headers: { etag } })
  }

  globalThis.fetch = fetchStub(async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.searchParams.get('list-type') === '2') return list(url)
    const prefix = `/${config.bucket}/`
    if (!url.pathname.startsWith(prefix)) return errorResponse(404, 'NoSuchBucket', 'bucket')
    const key = decodeURIComponent(url.pathname.slice(prefix.length))
    const ifMatch = request.headers.get('if-match')
    const range = request.headers.get('range')
    requests.push({ method: request.method, key, ifMatch, range })
    if (request.method === 'PUT') return write(key, request, ifMatch)
    if (request.method === 'DELETE') {
      objects.delete(key)
      etags.delete(key)
      return new Response(null, { status: 204 })
    }
    return read(key, request.method, range)
  })

  const bucket: MemoryS3 = {
    objects,
    requests,
    beforePut: null,
    failOnce: (keyMarker, status = 500) => {
      failOnceMarkers.push({ marker: keyMarker, status })
    },
    setLastModified: (key, iso) => {
      lastModified.set(key, iso)
    },
    seed: (key, body) => {
      store(key, typeof body === 'string' ? new TextEncoder().encode(body) : body)
    },
    restore: () => {
      globalThis.fetch = originalFetch
    }
  }
  return bucket
}
