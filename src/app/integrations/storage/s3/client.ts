import { AwsClient } from 'aws4fetch'

import { storageFetch, storageFetchTimeoutForBody } from '@/app/integrations/storage/s3/fetch'
import { inferS3Region } from '@/app/integrations/storage/s3/region'
import type { S3CompatibleConfig } from '@/app/integrations/storage/s3/types'
import {
  parseListObjectsV2Page,
  parseS3ErrorXml,
  type ListedObject
} from '@/app/integrations/storage/s3/xml'

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
export function objectUrl(config: S3CompatibleConfig, key: string): string {
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
  return parseS3ErrorXml(text, res.status)
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
    xhr.onload = () => {
      // Multipart UploadPart needs the ETag response header; without exposing
      // it here the progress-reporting path would silently lose it.
      const headers = new Headers()
      const etag = xhr.getResponseHeader('etag')
      if (etag) headers.set('etag', etag)
      resolve(new Response(xhr.responseText, { status: xhr.status, headers }))
    }
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
      res = await storageFetch(
        signed.url,
        {
          method: signed.method,
          headers: signed.headers,
          body: init.body ?? undefined,
          credentials: 'omit'
        },
        storageFetchTimeoutForBody(length)
      )
    }
  } catch (error) {
    // Re-export as a typed error so UI can detect CORS/network blocks.
    const { CloudCorsError, isLikelyCorsOrNetworkError, formatBrowserCorsHelpMessage } =
      await import('@/app/integrations/storage/s3/cors')
    if (isLikelyCorsOrNetworkError(error)) {
      // Keep the browser's own words. The guidance is rendered beside the raw
      // error, not in place of it — "CORS issue: …" alone tells a bug report
      // nothing about what actually failed, and `TypeError: Failed to fetch` is
      // the string anyone searching for this will recognise.
      const cause = error instanceof Error ? error.message : String(error)
      throw new CloudCorsError(`${formatBrowserCorsHelpMessage()}\n\n${cause}`)
    }
    throw error
  }
  if (res.ok || res.status === 404) return res
  const { message, code } = await readErrorBody(res)
  throw new S3HttpError(res.status, message, code)
}

export async function headObject(config: S3CompatibleConfig, key: string): Promise<boolean> {
  const res = await s3Request(config, objectUrl(config, key), { method: 'HEAD' })
  if (res.status === 404) return false
  return true
}

export async function putObject(
  config: S3CompatibleConfig,
  key: string,
  body: Uint8Array | string,
  contentType: string,
  onUploadProgress?: (progress: UploadProgress) => void
): Promise<void> {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body
  // Exact ArrayBuffer so fetch/UA can set Content-Length (required by B2 for large PUTs).
  const payload = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
  const res = await s3Request(
    config,
    objectUrl(config, key),
    {
      method: 'PUT',
      headers: {
        'Content-Type': contentType
      },
      body: payload
    },
    onUploadProgress
  )
  if (!res.ok) {
    // The provider's own words are the actionable part. Replacing them with
    // "Failed to upload <key>" left every distinct cause — no such bucket,
    // access denied, clock skew, signature mismatch — reading identically, and
    // each of those needs a completely different fix.
    const { message, code } = await readErrorBody(res)
    throw new S3HttpError(res.status, `Failed to upload ${key}: ${message}`, code)
  }
}

export type DownloadProgress = { receivedBytes: number; totalBytes: number | null }

export async function getObject(
  config: S3CompatibleConfig,
  key: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<Uint8Array | null> {
  const res = await s3Request(config, objectUrl(config, key), { method: 'GET' })
  if (res.status === 404) return null
  if (!onProgress || !res.body) {
    return new Uint8Array(await res.arrayBuffer())
  }

  // Stream so large figs can report download progress
  const contentLength = Number(res.headers.get('content-length'))
  const totalBytes = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let receivedBytes = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    receivedBytes += value.byteLength
    onProgress({ receivedBytes, totalBytes })
  }
  const out = new Uint8Array(receivedBytes)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

export async function deleteObject(config: S3CompatibleConfig, key: string): Promise<void> {
  const res = await s3Request(config, objectUrl(config, key), { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    throw new S3HttpError(res.status, `Failed to delete ${key}`)
  }
}

/** Below this, a single PUT is cheaper than multipart session overhead. */
const MULTIPART_THRESHOLD_BYTES = 16 * 1024 * 1024
/** Above S3's 5 MB minimum-part rule; 10,000 of these covers 80 GB (Bunny's cap). */
const MULTIPART_PART_SIZE = 8 * 1024 * 1024
const MULTIPART_PART_ATTEMPTS = 3
/** Bunny multipart sessions expire after 10 days; a stale session restarts cleanly. */
const MULTIPART_SESSION_RESTARTS = 2

/** A multipart upload id the provider no longer knows (expired or aborted). */
export class S3UploadSessionExpiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'S3UploadSessionExpiredError'
  }
}

function parseUploadId(xml: string): string | null {
  return /<UploadId>([^<]+)<\/UploadId>/.exec(xml)?.[1] ?? null
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function multipartUrl(
  config: S3CompatibleConfig,
  key: string,
  uploadId: string,
  partNumber?: number
): string {
  const params = new URLSearchParams()
  if (partNumber !== undefined) params.set('partNumber', String(partNumber))
  params.set('uploadId', uploadId)
  return `${objectUrl(config, key)}?${params.toString()}`
}

async function createMultipartUpload(
  config: S3CompatibleConfig,
  key: string,
  contentType: string
): Promise<string> {
  const res = await s3Request(config, `${objectUrl(config, key)}?uploads`, {
    method: 'POST',
    headers: { 'Content-Type': contentType }
  })
  if (!res.ok) {
    const { message, code } = await readErrorBody(res)
    throw new S3HttpError(res.status, message, code)
  }
  const uploadId = parseUploadId(await res.text())
  if (!uploadId) {
    throw new S3HttpError(res.status, `CreateMultipartUpload for ${key} returned no UploadId`)
  }
  return uploadId
}

async function readPartError(res: Response, key: string): Promise<never> {
  const { message, code } = await readErrorBody(res)
  if (code === 'NoSuchUpload') throw new S3UploadSessionExpiredError(message)
  throw new S3HttpError(res.status, `Failed to upload ${key}: ${message}`, code)
}

/**
 * One part, retried within the session. The returned ETag is OPAQUE — echoed
 * verbatim into the completion request and never parsed (multipart ETags are
 * not MD5s, and treating them as such breaks conditional requests later).
 */
async function uploadPartWithRetry(
  config: S3CompatibleConfig,
  key: string,
  uploadId: string,
  partNumber: number,
  chunk: Uint8Array,
  onLoaded: (loadedBytes: number) => void
): Promise<string> {
  const payload = chunk.buffer.slice(
    chunk.byteOffset,
    chunk.byteOffset + chunk.byteLength
  ) as ArrayBuffer
  for (let attempt = 1; attempt <= MULTIPART_PART_ATTEMPTS; attempt++) {
    try {
      const res = await s3Request(
        config,
        multipartUrl(config, key, uploadId, partNumber),
        { method: 'PUT', body: payload },
        (progress) => onLoaded(progress.sentBytes)
      )
      if (!res.ok) await readPartError(res, key)
      const etag = res.headers.get('etag')
      if (!etag) {
        throw new S3HttpError(
          res.status,
          `UploadPart for ${key} returned no ETag — expose ETag in the bucket CORS configuration`
        )
      }
      return etag
    } catch (error) {
      // Session expiry and credential/permission failures are not retryable here.
      if (error instanceof S3UploadSessionExpiredError) throw error
      if (error instanceof S3HttpError && (error.status === 401 || error.status === 403)) {
        throw error
      }
      if (attempt === MULTIPART_PART_ATTEMPTS) throw error
    }
  }
  throw new Error('unreachable')
}

async function completeMultipartUpload(
  config: S3CompatibleConfig,
  key: string,
  uploadId: string,
  partETags: string[]
): Promise<void> {
  const xml = `<CompleteMultipartUpload>${partETags
    .map(
      (etag, index) =>
        `<Part><PartNumber>${index + 1}</PartNumber><ETag>${escapeXml(etag)}</ETag></Part>`
    )
    .join('')}</CompleteMultipartUpload>`
  const res = await s3Request(config, multipartUrl(config, key, uploadId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: xml
  })
  if (!res.ok) await readPartError(res, key)
}

async function abortMultipartUpload(
  config: S3CompatibleConfig,
  key: string,
  uploadId: string
): Promise<void> {
  await s3Request(config, multipartUrl(config, key, uploadId), { method: 'DELETE' })
}

/**
 * Upload with resume semantics: a single PUT below the threshold, multipart
 * above it. The retry unit is the PART — a failure near the end of a large
 * document discards parts, not the whole upload, and parts the provider
 * already acknowledged are never re-transferred, including across a session
 * restart (Bunny sessions expire after 10 days).
 */
export async function putObjectResumable(
  config: S3CompatibleConfig,
  key: string,
  body: Uint8Array | string,
  contentType: string,
  onUploadProgress?: (progress: UploadProgress) => void
): Promise<void> {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body
  if (bytes.byteLength < MULTIPART_THRESHOLD_BYTES) {
    return putObject(config, key, bytes, contentType, onUploadProgress)
  }

  const partCount = Math.ceil(bytes.byteLength / MULTIPART_PART_SIZE)
  // Acknowledged parts, by index. Survives session restarts deliberately.
  const partETags: (string | null)[] = Array.from({ length: partCount }, () => null)
  let acknowledgedBytes = 0

  for (let restart = 0; restart <= MULTIPART_SESSION_RESTARTS; restart++) {
    const uploadId = await createMultipartUpload(config, key, contentType)
    try {
      for (let part = 0; part < partCount; part++) {
        if (partETags[part] !== null) continue
        const start = part * MULTIPART_PART_SIZE
        const chunk = bytes.subarray(start, Math.min(start + MULTIPART_PART_SIZE, bytes.byteLength))
        const progressBase = acknowledgedBytes
        partETags[part] = await uploadPartWithRetry(
          config,
          key,
          uploadId,
          part + 1,
          chunk,
          (loaded) =>
            onUploadProgress?.({
              sentBytes: progressBase + loaded,
              totalBytes: bytes.byteLength
            })
        )
        acknowledgedBytes += chunk.byteLength
        onUploadProgress?.({ sentBytes: acknowledgedBytes, totalBytes: bytes.byteLength })
      }
      await completeMultipartUpload(config, key, uploadId, partETags as string[])
      return
    } catch (error) {
      // A dead session is normal, not an error: abort best-effort and start a
      // fresh one, re-sending only parts the provider never acknowledged.
      const canRestart =
        error instanceof S3UploadSessionExpiredError && restart < MULTIPART_SESSION_RESTARTS
      await abortMultipartUpload(config, key, uploadId).catch(() => undefined)
      if (!canRestart) throw error
    }
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
