import type {
  CreateObjectDownloadInput,
  CreateObjectUploadInput,
  ObjectStore,
  StoredObject
} from '#cloud/server/objects'
import { base64url } from 'jose'

const OBJECT_PATH = '/_openpencil/r2/'

export type CloudflareR2Object = {
  size: number
  customMetadata?: Record<string, string>
  httpMetadata?: { contentType?: string }
}

export type CloudflareR2ObjectBody = CloudflareR2Object & {
  body: ReadableStream<Uint8Array>
}

export type CloudflareR2Bucket = {
  head(key: string): Promise<CloudflareR2Object | null>
  get(key: string): Promise<CloudflareR2ObjectBody | null>
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView,
    options?: {
      customMetadata?: Record<string, string>
      httpMetadata?: { contentType?: string }
    }
  ): Promise<CloudflareR2Object>
  delete(key: string): Promise<void>
}

type SignedObjectRequest = {
  method: 'GET' | 'PUT'
  key: string
  expires: number
  checksum?: string
  byteSize?: number
  contentType?: string
}

function encodedKey(key: string): string {
  return base64url.encode(new TextEncoder().encode(key))
}

function decodedKey(value: string): string {
  return new TextDecoder().decode(base64url.decode(value))
}

function signaturePayload(input: SignedObjectRequest): string {
  return [
    input.method,
    input.key,
    input.expires,
    input.checksum ?? '',
    input.byteSize ?? '',
    input.contentType ?? ''
  ].join('\n')
}

async function signature(secret: string, input: SignedObjectRequest): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return base64url.encode(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signaturePayload(input)))
    )
  )
}

async function signedURL(publicURL: string, secret: string, input: SignedObjectRequest) {
  const url = new URL(`${OBJECT_PATH}${encodedKey(input.key)}`, publicURL)
  url.searchParams.set('expires', String(input.expires))
  if (input.checksum) url.searchParams.set('checksum', input.checksum)
  if (input.byteSize !== undefined) url.searchParams.set('size', String(input.byteSize))
  if (input.contentType) url.searchParams.set('type', input.contentType)
  url.searchParams.set('signature', await signature(secret, input))
  return url.href
}

function storedObject(object: CloudflareR2Object): StoredObject | null {
  const checksum = object.customMetadata?.sha256
  const contentType = object.httpMetadata?.contentType
  if (!checksum || !contentType) return null
  return {
    byteSize: object.size,
    checksum,
    checksumVerification: 'metadata',
    contentType
  }
}

export function createCloudflareR2ObjectStore(options: {
  bucket: CloudflareR2Bucket
  publicURL: string
  signingSecret: string
}) {
  const store: ObjectStore = {
    capabilities: {
      nativeSHA256: false,
      multipartUpload: false,
      conditionalWrites: false
    },
    async checkReadiness() {
      return { ok: true, checksumVerification: 'metadata' }
    },
    async createDownload(input: CreateObjectDownloadInput) {
      const expires = input.expiresAt.getTime()
      return {
        url: await signedURL(options.publicURL, options.signingSecret, {
          method: 'GET',
          key: input.key,
          expires
        }),
        method: 'GET' as const,
        headers: {},
        expiresAt: input.expiresAt.toISOString()
      }
    },
    async createUpload(input: CreateObjectUploadInput) {
      const expires = input.expiresAt.getTime()
      return {
        kind: 'single' as const,
        url: await signedURL(options.publicURL, options.signingSecret, {
          method: 'PUT',
          key: input.key,
          expires,
          checksum: input.checksum,
          byteSize: input.byteSize,
          contentType: input.contentType
        }),
        method: 'PUT' as const,
        headers: { 'Content-Type': input.contentType },
        expiresAt: input.expiresAt.toISOString()
      }
    },
    async completeUpload() {},
    async abortUpload() {},
    async head(key) {
      const object = await options.bucket.head(key)
      return object ? storedObject(object) : null
    },
    async delete(key) {
      await options.bucket.delete(key)
    }
  }

  async function handleRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith(OBJECT_PATH)) return null
    const key = decodedKey(url.pathname.slice(OBJECT_PATH.length))
    const expires = Number(url.searchParams.get('expires'))
    const checksum = url.searchParams.get('checksum') ?? undefined
    const sizeValue = url.searchParams.get('size')
    const byteSize = sizeValue === null ? undefined : Number(sizeValue)
    const contentType = url.searchParams.get('type') ?? undefined
    const method = request.method === 'PUT' ? 'PUT' : request.method === 'GET' ? 'GET' : null
    if (!method || !Number.isFinite(expires) || expires <= Date.now()) {
      return new Response('Invalid object request', { status: 403 })
    }
    const expected = await signature(options.signingSecret, {
      method,
      key,
      expires,
      checksum,
      byteSize,
      contentType
    })
    if (expected !== url.searchParams.get('signature')) {
      return new Response('Invalid object request', { status: 403 })
    }
    if (method === 'GET') {
      const object = await options.bucket.get(key)
      if (!object) return new Response('Not found', { status: 404 })
      return new Response(object.body, {
        headers: {
          'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
          'Content-Length': String(object.size)
        }
      })
    }
    if (!request.body || !checksum || byteSize === undefined || !contentType) {
      return new Response('Invalid object upload', { status: 400 })
    }
    const contentLength = Number(request.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength !== byteSize) {
      return new Response('Invalid object size', { status: 400 })
    }
    await options.bucket.put(key, request.body, {
      customMetadata: { sha256: checksum },
      httpMetadata: { contentType }
    })
    return new Response(null, { status: 204 })
  }

  return { store, handleRequest }
}

export type CloudflareR2ObjectStore = ReturnType<typeof createCloudflareR2ObjectStore>
