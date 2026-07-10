import { AwsClient } from 'aws4fetch'

import { cloudFetch } from '@/app/cloud/s3/fetch'
import { inferS3Region } from '@/app/cloud/s3/region'
import type { S3CompatibleConfig } from '@/app/cloud/types'

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

/** Alias for CORS module import clarity. */
export const normalizeEndpointForCors = normalizeEndpoint

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
  const codeMatch = text.match(/<Code>([^<]+)<\/Code>/i)
  const messageMatch = text.match(/<Message>([^<]+)<\/Message>/i)
  const code = codeMatch?.[1] ?? null
  const message =
    messageMatch?.[1] ??
    (text.trim() ? text.trim().slice(0, 200) : `S3 request failed with status ${res.status}`)
  return { message, code }
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

export async function s3Request(
  config: S3CompatibleConfig,
  url: string,
  init: RequestInit = {}
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
    res = await cloudFetch(signed.url, {
      method: signed.method,
      headers: signed.headers,
      body: init.body ?? undefined,
      credentials: 'omit'
    })
  } catch (error) {
    // Re-export as a typed error so UI can detect CORS/network blocks.
    const { CloudCorsError, isLikelyCorsOrNetworkError, formatBrowserCorsHelpMessage } =
      await import('@/app/cloud/s3/cors')
    if (isLikelyCorsOrNetworkError(error)) {
      throw new CloudCorsError(formatBrowserCorsHelpMessage())
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
  contentType: string
): Promise<void> {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body
  // Exact ArrayBuffer so fetch/UA can set Content-Length (required by B2 for large PUTs).
  const payload = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
  const res = await s3Request(config, objectUrl(config, key), {
    method: 'PUT',
    headers: {
      'Content-Type': contentType
    },
    body: payload
  })
  if (!res.ok) {
    throw new S3HttpError(res.status, `Failed to upload ${key}`)
  }
}

export async function getObject(
  config: S3CompatibleConfig,
  key: string
): Promise<Uint8Array | null> {
  const res = await s3Request(config, objectUrl(config, key), { method: 'GET' })
  if (res.status === 404) return null
  return new Uint8Array(await res.arrayBuffer())
}

export async function deleteObject(config: S3CompatibleConfig, key: string): Promise<void> {
  const res = await s3Request(config, objectUrl(config, key), { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    throw new S3HttpError(res.status, `Failed to delete ${key}`)
  }
}

export type ListedObject = {
  key: string
  lastModified: string | null
  size: number | null
}

export type ListObjectsPage = {
  objects: ListedObject[]
  isTruncated: boolean
  nextContinuationToken: string | null
}

/** Parse ListObjectsV2 XML into key entries. Pure for unit tests. */
export function parseListObjectsV2Xml(xml: string): ListedObject[] {
  return parseListObjectsV2Page(xml).objects
}

/** Parse ListObjectsV2 XML including pagination fields. */
export function parseListObjectsV2Page(xml: string): ListObjectsPage {
  const contents = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/gi)]
  const items: ListedObject[] = []
  for (const match of contents) {
    const block = match[1] ?? ''
    const key = block.match(/<Key>([^<]*)<\/Key>/i)?.[1]
    if (!key) continue
    const lastModified = block.match(/<LastModified>([^<]*)<\/LastModified>/i)?.[1] ?? null
    const sizeRaw = block.match(/<Size>([^<]*)<\/Size>/i)?.[1]
    const size = sizeRaw != null && sizeRaw !== '' ? Number(sizeRaw) : null
    items.push({
      key: decodeXmlEntities(key),
      lastModified,
      size: Number.isFinite(size) ? size : null
    })
  }
  const truncatedRaw = xml.match(/<IsTruncated>([^<]*)<\/IsTruncated>/i)?.[1]
  const isTruncated = truncatedRaw?.trim().toLowerCase() === 'true'
  const tokenRaw = xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/i)?.[1]
  return {
    objects: items,
    isTruncated,
    nextContinuationToken: tokenRaw ? decodeXmlEntities(tokenRaw) : null
  }
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
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
    continuationToken = parsed.nextContinuationToken
  }

  return all
}
