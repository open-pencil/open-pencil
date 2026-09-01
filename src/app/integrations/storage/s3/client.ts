import { AwsClient } from 'aws4fetch'

import { storageFetch } from '@/app/integrations/storage/s3/fetch'
import { inferS3Region } from '@/app/integrations/storage/s3/region'
import type { S3CompatibleConfig } from '@/app/integrations/storage/s3/types'
import {
  parseListObjectsV2Page,
  parseS3ErrorXML,
  type ListedObject
} from '@/app/integrations/storage/s3/xml'
import type { LibraryObjectWriteOptions } from '@/app/integrations/storage/types'

export function resolveS3Region(config: S3CompatibleConfig): string {
  const explicit = config.region?.trim()
  if (explicit) return explicit
  return inferS3Region(config.endpoint)
}

export class S3HttpError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(status: number, message: string, code: string | null = null) {
    super(message)
    this.name = 'S3HttpError'
    this.status = status
    this.code = code
  }
}

export function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error('S3 endpoint is required')
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `https://${trimmed}`
}

/** Path-style object URL: {endpoint}/{bucket}/{key} — works with B2, MinIO, R2, AWS. */
export function objectURL(config: S3CompatibleConfig, key: string): string {
  const base = normalizeEndpoint(config.endpoint)
  const encodedKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `${base}/${encodeURIComponent(config.bucket)}/${encodedKey}`
}

export function createAwsClient(config: S3CompatibleConfig): AwsClient {
  return new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: resolveS3Region(config),
    service: 's3'
  })
}

async function readErrorBody(res: Response): Promise<{ message: string; code: string | null }> {
  const text = await res.text().catch(() => '')
  return parseS3ErrorXML(text, res.status)
}

/**
 * Known-length body types that UAs can send with Content-Length.
 * Prefer these over Request-wrapped streams — B2 rejects missing Content-Length (411)
 * and some browsers hang on chunked S3 PUTs.
 */
function bodyByteLength(body: BodyInit | null | undefined): number | null {
  if (body == null) return null
  if (typeof body === 'string') return new TextEncoder().encode(body).byteLength
  if (body instanceof ArrayBuffer) return body.byteLength
  if (ArrayBuffer.isView(body)) return body.byteLength
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.size
  return null
}

export type UploadProgress = { sentBytes: number; totalBytes: number | null }

/**
 * fetch() cannot observe upload progress — replay the signed request over
 * XMLHttpRequest when a progress callback is attached (uploads only).
 */
function xhrSend(
  url: string,
  method: string,
  headers: Headers,
  body: BodyInit | undefined,
  onUploadProgress: (progress: UploadProgress) => void
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, url)
    headers.forEach((value, key) => {
      // Forbidden request headers are set by the browser itself
      if (/^(content-length|host)$/i.test(key)) return
      xhr.setRequestHeader(key, value)
    })
    xhr.responseType = 'text'
    xhr.upload.onprogress = (e) => {
      onUploadProgress({ sentBytes: e.loaded, totalBytes: e.lengthComputable ? e.total : null })
    }
    xhr.onload = () => resolve(new Response(xhr.responseText, { status: xhr.status }))
    // Same shape the fetch path throws so CORS/network detection keeps working
    xhr.onerror = () => reject(new TypeError('Failed to fetch'))
    xhr.send(body as XMLHttpRequestBodyInit)
  })
}

export async function s3Request(
  config: S3CompatibleConfig,
  url: string,
  init: RequestInit = {},
  onUploadProgress?: (progress: UploadProgress) => void
): Promise<Response> {
  const client = createAwsClient(config)
  const length = bodyByteLength(init.body ?? null)
  const headers = new Headers(init.headers)
  // Never send cookies; avoids credentialed CORS mode.
  // Set Content-Length when we know size. aws4fetch leaves it unsignable (correct for S3).
  // Critical for Backblaze B2 large binary PUTs.
  if (length != null && !headers.has('Content-Length')) {
    headers.set('Content-Length', String(length))
  }
  // Sign with aws4fetch, then re-issue with url+init so the body keeps a known length.
  // Passing only the signed Request object can drop Content-Length on some runtimes.
  const signed = await client.sign(url, {
    ...init,
    headers,
    credentials: 'omit'
  })
  let res: Response
  try {
    if (onUploadProgress && typeof XMLHttpRequest !== 'undefined') {
      res = await xhrSend(
        signed.url,
        signed.method,
        signed.headers,
        init.body ?? undefined,
        onUploadProgress
      )
    } else {
      res = await storageFetch(signed.url, {
        method: signed.method,
        headers: signed.headers,
        body: init.body ?? undefined,
        credentials: 'omit',
        signal: init.signal
      })
    }
  } catch (error) {
    // Re-export as a typed error so UI can detect CORS/network blocks.
    const { CloudCORSError, isLikelyCORSOrNetworkError, formatBrowserCORSHelpMessage } =
      await import('@/app/integrations/storage/s3/cors')
    if (isLikelyCORSOrNetworkError(error)) {
      throw new CloudCORSError(formatBrowserCORSHelpMessage())
    }
    throw error
  }
  if (res.ok || res.status === 404) return res
  const { message, code } = await readErrorBody(res)
  throw new S3HttpError(res.status, message, code)
}

export async function headObject(config: S3CompatibleConfig, key: string): Promise<boolean> {
  const res = await s3Request(config, objectURL(config, key), { method: 'HEAD' })
  if (res.status === 404) return false
  return true
}

export async function headObjectSize(
  config: S3CompatibleConfig,
  key: string
): Promise<number | null> {
  const res = await s3Request(config, objectURL(config, key), { method: 'HEAD' })
  if (res.status === 404) return null
  const sizeHeader = res.headers.get('content-length')
  if (sizeHeader == null) return null
  const size = Number(sizeHeader)
  return Number.isSafeInteger(size) && size >= 0 ? size : null
}

export async function getObjectRange(
  config: S3CompatibleConfig,
  key: string,
  start: number,
  endExclusive: number
): Promise<Uint8Array | null> {
  if (
    !Number.isSafeInteger(start) ||
    start < 0 ||
    !Number.isSafeInteger(endExclusive) ||
    endExclusive <= start
  ) {
    throw new Error('Invalid S3 byte range')
  }
  const res = await s3Request(config, objectURL(config, key), {
    method: 'GET',
    headers: { Range: `bytes=${start}-${endExclusive - 1}` }
  })
  if (res.status === 404) return null
  if (res.status !== 206) throw new Error('Storage provider did not honor the thumbnail byte range')
  return new Uint8Array(await res.arrayBuffer())
}

export async function putObject(
  config: S3CompatibleConfig,
  key: string,
  body: Uint8Array | string,
  contentType: string,
  onUploadProgress?: (progress: UploadProgress) => void,
  options?: LibraryObjectWriteOptions
): Promise<void> {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body
  // Exact ArrayBuffer so fetch/UA can set Content-Length (required by B2 for large PUTs).
  const payload = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
  const headers: Record<string, string> = { 'Content-Type': contentType }
  if (options?.ifMatch) headers['If-Match'] = options.ifMatch
  if (options?.ifNoneMatch) headers['If-None-Match'] = options.ifNoneMatch
  const res = await s3Request(
    config,
    objectURL(config, key),
    {
      method: 'PUT',
      headers,
      body: payload
    },
    onUploadProgress
  )
  if (!res.ok) {
    throw new S3HttpError(res.status, `Failed to upload ${key}`)
  }
}

export async function getObjectValue(
  config: S3CompatibleConfig,
  key: string
): Promise<{ bytes: Uint8Array | null; etag: string | null }> {
  const res = await s3Request(config, objectURL(config, key), { method: 'GET' })
  if (res.status === 404) return { bytes: null, etag: null }
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    etag: res.headers.get('etag')
  }
}

export type DownloadProgress = { receivedBytes: number; totalBytes: number | null }

export async function readDownloadResponse(
  res: Response,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<Uint8Array> {
  signal?.throwIfAborted()
  if (!onProgress || !res.body) return new Uint8Array(await res.arrayBuffer())

  const contentLength = Number(res.headers.get('content-length'))
  const totalBytes = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let receivedBytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      signal?.throwIfAborted()
      if (done) break
      chunks.push(value)
      receivedBytes += value.byteLength
      onProgress({ receivedBytes, totalBytes })
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  }
  const out = new Uint8Array(receivedBytes)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

export async function getObject(
  config: S3CompatibleConfig,
  key: string,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<Uint8Array | null> {
  signal?.throwIfAborted()
  const res = await s3Request(config, objectURL(config, key), { method: 'GET', signal })
  if (res.status === 404) return null
  return readDownloadResponse(res, onProgress, signal)
}

export async function deleteObject(config: S3CompatibleConfig, key: string): Promise<void> {
  const res = await s3Request(config, objectURL(config, key), { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    throw new S3HttpError(res.status, `Failed to delete ${key}`)
  }
}

export async function listObjects(
  config: S3CompatibleConfig,
  prefix: string
): Promise<ListedObject[]> {
  const base = normalizeEndpoint(config.endpoint)
  const all: ListedObject[] = []
  let continuationToken: string | null = null

  for (let page = 0; page < 50; page++) {
    const params = new URLSearchParams({
      'list-type': '2',
      prefix,
      'max-keys': '1000'
    })
    if (continuationToken) params.set('continuation-token', continuationToken)
    const url = `${base}/${encodeURIComponent(config.bucket)}?${params.toString()}`
    const res = await s3Request(config, url, { method: 'GET' })
    if (!res.ok) {
      throw new S3HttpError(res.status, 'Failed to list objects')
    }
    const xml = await res.text()
    const parsed = parseListObjectsV2Page(xml)
    all.push(...parsed.objects)
    if (!parsed.isTruncated || !parsed.nextContinuationToken) break
    if (page === 49) {
      throw new Error('S3 listing exceeded the 50,000-object safety limit')
    }
    continuationToken = parsed.nextContinuationToken
  }

  return all
}
