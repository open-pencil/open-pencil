import { retry, Semaphore } from 'es-toolkit'

import type { CloudAPIClient, CloudUpload } from '@open-pencil/cloud/client'

import type { StorageTransferProgress } from '../types'

const MULTIPART_CONCURRENCY = 4
const PART_RETRIES = 2
const RETRY_DELAY_MS = 200

type ObjectFetch = (input: string, init: RequestInit) => Promise<Response>
type MultipartUpload = Extract<CloudUpload['upload'], { kind: 'multipart' }>

export type CloudObjectUpload = {
  cloud: Pick<CloudAPIClient, 'createUpload'>
  documentId: string
  bytes: Uint8Array
  checksum: string
  baseRevision: string | null
  objectFetch: ObjectFetch
  onProgress?: (progress: StorageTransferProgress) => void
  signal?: AbortSignal
}

export type CloudObjectUploadResult = {
  uploadId: string
  multipart?: { uploadId: string; parts: { partNumber: number; etag: string }[] }
}

/** An object-store request the presigned URL refused or the store failed. */
class ObjectUploadError extends Error {
  override readonly name = 'ObjectUploadError'
  constructor(readonly status: number) {
    super(`Cloud object upload failed with HTTP ${status}`)
  }
}

const retryable = (status: number) => status === 408 || status === 429 || status >= 500
// Presigned URLs expire; a fresh upload session gets new ones.
const expired = (error: unknown) =>
  error instanceof ObjectUploadError && (error.status === 401 || error.status === 403)

function body(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return bytes.buffer instanceof ArrayBuffer
    ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    : Uint8Array.from(bytes)
}

function report(upload: CloudObjectUpload, transferredBytes: number): void {
  upload.onProgress?.({ transferredBytes, totalBytes: upload.bytes.byteLength })
}

async function putPart(
  upload: CloudObjectUpload,
  part: MultipartUpload['parts'][number],
  bytes: Uint8Array,
  signal: AbortSignal
): Promise<string> {
  return retry(
    async () => {
      const response = await upload.objectFetch(part.url, {
        method: part.method,
        headers: part.headers,
        body: body(bytes),
        signal
      })
      if (!response.ok) throw new ObjectUploadError(response.status)
      const etag = response.headers.get('etag')
      if (!etag) throw new Error('Cloud multipart upload response did not include an ETag')
      return etag
    },
    {
      retries: PART_RETRIES,
      delay: (attempt) => RETRY_DELAY_MS * 2 ** attempt,
      signal,
      shouldRetry: (error) => error instanceof ObjectUploadError && retryable(error.status)
    }
  )
}

async function putParts(upload: CloudObjectUpload, multipart: MultipartUpload) {
  const controller = new AbortController()
  const stop = () => controller.abort(upload.signal?.reason)
  upload.signal?.addEventListener('abort', stop, { once: true })
  const semaphore = new Semaphore(Math.min(MULTIPART_CONCURRENCY, multipart.parts.length))
  let transferred = 0
  try {
    return await Promise.all(
      multipart.parts.map(async (part) => {
        await semaphore.acquire()
        try {
          controller.signal.throwIfAborted()
          const start = (part.partNumber - 1) * multipart.partSize
          const bytes = upload.bytes.subarray(start, start + multipart.partSize)
          const etag = await putPart(upload, part, bytes, controller.signal)
          transferred += bytes.byteLength
          report(upload, transferred)
          return { partNumber: part.partNumber, etag }
        } catch (error) {
          // One failed part fails the upload; the others stop instead of finishing for nothing.
          controller.abort(error)
          throw error
        } finally {
          semaphore.release()
        }
      })
    )
  } finally {
    upload.signal?.removeEventListener('abort', stop)
  }
}

async function transfer(upload: CloudObjectUpload): Promise<CloudObjectUploadResult> {
  const pending = await upload.cloud.createUpload(upload.documentId, {
    baseRevisionId: upload.baseRevision,
    byteSize: upload.bytes.byteLength,
    checksum: upload.checksum,
    contentType: 'application/octet-stream'
  })
  report(upload, 0)
  if (pending.upload.kind === 'single') {
    const response = await upload.objectFetch(pending.upload.url, {
      method: pending.upload.method,
      headers: pending.upload.headers,
      body: body(upload.bytes),
      signal: upload.signal
    })
    if (!response.ok) throw new ObjectUploadError(response.status)
    report(upload, upload.bytes.byteLength)
    return { uploadId: pending.id }
  }
  const parts = await putParts(upload, pending.upload)
  return { uploadId: pending.id, multipart: { uploadId: pending.upload.uploadId, parts } }
}

/**
 * Sends a document's bytes straight to the server's object store through presigned URLs, in
 * parallel parts for large files, starting once more if the URLs expired on the way.
 */
export async function uploadCloudObject(
  upload: CloudObjectUpload
): Promise<CloudObjectUploadResult> {
  try {
    return await transfer(upload)
  } catch (error) {
    if (!expired(error)) throw error
    upload.signal?.throwIfAborted()
    return transfer(upload)
  }
}
