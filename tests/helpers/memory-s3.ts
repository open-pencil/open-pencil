import type { S3CompatibleConfig } from '@/app/integrations/storage/s3/types'

export type MemoryS3 = {
  objects: Map<string, Uint8Array>
  requests: { method: string; key: string; ifMatch: string | null }[]
  /** Fail the next PUT whose key contains the marker, once, with `status`. */
  failOnce: (keyMarker: string, status?: number) => void
  /** Age or rejuvenate an object for GC safety-window assertions. */
  setLastModified: (key: string, iso: string) => void
}

/**
 * An in-memory object store speaking enough S3 (PUT/GET/HEAD/DELETE and
 * ListObjectsV2) for adapter-level tests, including crash injection between
 * the versioned layout's commit steps.
 */
const DEFAULT_LAST_MODIFIED = '2026-08-04T00:00:00.000Z'

function ifMatchOf(init?: RequestInit): string | null {
  if (!init?.headers) return null
  if (init.headers instanceof Headers) return init.headers.get('if-match')
  return (init.headers as Record<string, string>)['If-Match'] ?? null
}

function urlOf(input: RequestInfo | URL): URL {
  if (typeof input === 'string') return new URL(input)
  if (input instanceof URL) return input
  return new URL(input.url)
}

function requestBody(init?: RequestInit): Uint8Array {
  const body = init?.body
  if (typeof body === 'string') return new TextEncoder().encode(body)
  return new Uint8Array(body as ArrayBuffer)
}

function listResponse(
  objects: Map<string, Uint8Array>,
  lastModifiedOverrides: Map<string, string>,
  url: URL
): Response {
  const listPrefix = url.searchParams.get('prefix') ?? ''
  const contents = [...objects.entries()]
    .filter(([key]) => key.startsWith(listPrefix))
    .map(
      ([key, body]) =>
        `<Contents><Key>${key}</Key><LastModified>${lastModifiedOverrides.get(key) ?? DEFAULT_LAST_MODIFIED}</LastModified><Size>${body.byteLength}</Size></Contents>`
    )
    .join('')
  return new Response(
    `<ListBucketResult>${contents}<IsTruncated>false</IsTruncated></ListBucketResult>`,
    { status: 200 }
  )
}

type PutState = {
  objects: Map<string, Uint8Array>
  etags: Map<string, string>
  failOnceMarkers: { marker: string; status: number }[]
  etagCounter: number
}

function putResponse(
  state: PutState,
  key: string,
  ifMatch: string | null,
  init?: RequestInit
): Response {
  const marker = state.failOnceMarkers.findIndex((fail) => key.includes(fail.marker))
  if (marker !== -1) {
    const { status } = state.failOnceMarkers[marker]
    state.failOnceMarkers.splice(marker, 1)
    return new Response(
      '<Error><Code>InternalError</Code><Message>injected crash</Message></Error>',
      { status }
    )
  }
  if (ifMatch !== null && state.etags.get(key) !== ifMatch) {
    return new Response(
      '<Error><Code>PreconditionFailed</Code><Message>if-match mismatch</Message></Error>',
      { status: 412 }
    )
  }
  state.objects.set(key, requestBody(init))
  state.etagCounter += 1
  const etag = `"etag-${state.etagCounter}"`
  state.etags.set(key, etag)
  return new Response('', { status: 200, headers: { etag } })
}

export function installMemoryS3(config: S3CompatibleConfig): MemoryS3 {
  const objects = new Map<string, Uint8Array>()
  const etags = new Map<string, string>()
  const lastModifiedOverrides = new Map<string, string>()
  const requests: { method: string; key: string; ifMatch: string | null }[] = []
  const failOnceMarkers: { marker: string; status: number }[] = []
  const state: PutState = { objects, etags, failOnceMarkers, etagCounter: 0 }

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input)
    const method = init?.method ?? 'GET'
    const prefix = `/${config.bucket}/`
    if (url.searchParams.get('list-type') === '2') {
      return listResponse(objects, lastModifiedOverrides, url)
    }
    if (!url.pathname.startsWith(prefix)) return new Response('wrong bucket', { status: 404 })
    const key = decodeURIComponent(url.pathname.slice(prefix.length))
    const ifMatch = ifMatchOf(init)
    requests.push({ method, key, ifMatch })
    if (method === 'PUT') return putResponse(state, key, ifMatch, init)
    if (method === 'DELETE') {
      objects.delete(key)
      return new Response('', { status: 204 })
    }
    const body = objects.get(key)
    if (!body) {
      return new Response('<Error><Code>NoSuchKey</Code><Message>nope</Message></Error>', {
        status: 404
      })
    }
    const headers = { etag: etags.get(key) ?? '"none"' }
    if (method === 'HEAD') return new Response(null, { status: 200, headers })
    return new Response(body, { status: 200, headers })
  }) as typeof fetch

  return {
    objects,
    requests,
    failOnce: (keyMarker: string, status = 500) => {
      failOnceMarkers.push({ marker: keyMarker, status })
    },
    setLastModified: (key: string, iso: string) => {
      lastModifiedOverrides.set(key, iso)
    }
  }
}
