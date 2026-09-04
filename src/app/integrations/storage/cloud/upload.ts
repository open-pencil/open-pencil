import pLimit from 'p-limit'
import pRetry, { AbortError } from 'p-retry'

import type { CloudAPIClient, CloudUpload } from '@open-pencil/cloud/client'

import type { StorageTransferProgress } from '../types'
import type { CloudTransport } from './transport'

const DEFAULT_MULTIPART_CONCURRENCY = 4
const MAX_PART_ATTEMPTS = 3
const BASE_RETRY_DELAY_MS = 200

export type CloudObjectUploadOptions = {
  cloud: Pick<CloudAPIClient, 'createUpload'>
  documentId: string
  bytes: Uint8Array
  checksum: string
  baseRevisionId: string | null
  transport: CloudTransport
  onProgress?: (progress: StorageTransferProgress) => void
  signal?: AbortSignal
  multipartConcurrency?: number
}

export type CloudObjectUploadResult = {
  uploadId: string
  multipart?: {
    uploadId: string
    parts: Array<{ partNumber: number; etag: string }>
  }
}

type MultipartUpload = Extract<CloudUpload['upload'], { kind: 'multipart' }>
type MultipartPart = MultipartUpload['parts'][number]

class ObjectUploadError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(`${message} failed with HTTP ${status}`)
    this.name = 'ObjectUploadError'
  }
}

export async function uploadCloudObject(
  options: CloudObjectUploadOptions
): Promise<CloudObjectUploadResult> {
  let pending = await createUpload(options)
  reportProgress(options, 0)
  try {
    return await transferPendingUpload(options, pending)
  } catch (error) {
    if (!isExpiredPresignedRequest(error)) throw error
    throwIfAborted(options.signal)
    pending = await createUpload(options)
    reportProgress(options, 0)
    return transferPendingUpload(options, pending)
  }
}

async function createUpload(options: CloudObjectUploadOptions): Promise<CloudUpload> {
  return options.cloud.createUpload(options.documentId, {
    baseRevisionId: options.baseRevisionId,
    byteSize: options.bytes.byteLength,
    checksum: options.checksum,
    contentType: 'application/octet-stream'
  })
}

async function transferPendingUpload(
  options: CloudObjectUploadOptions,
  pending: CloudUpload
): Promise<CloudObjectUploadResult> {
  if (pending.upload.kind === 'single') {
    const response = await options.transport.objectFetch(pending.upload.url, {
      method: pending.upload.method,
      headers: pending.upload.headers,
      body: requestBody(options.bytes),
      signal: options.signal
    })
    if (!response.ok) throw new ObjectUploadError('Cloud document upload', response.status)
    reportProgress(options, options.bytes.byteLength)
    return { uploadId: pending.id }
  }
  const parts = await uploadMultipartParts(options, pending.upload)
  return {
    uploadId: pending.id,
    multipart: { uploadId: pending.upload.uploadId, parts }
  }
}

async function uploadMultipartParts(
  options: CloudObjectUploadOptions,
  upload: MultipartUpload
): Promise<Array<{ partNumber: number; etag: string }>> {
  const controller = new AbortController()
  const abort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', abort, { once: true })
  const limit = pLimit({
    concurrency: Math.max(
      1,
      Math.min(options.multipartConcurrency ?? DEFAULT_MULTIPART_CONCURRENCY, upload.parts.length)
    ),
    rejectOnClear: true
  })
  let transferredBytes = 0
  try {
    return await Promise.all(
      upload.parts.map((part) =>
        limit(async () => {
          throwIfAborted(controller.signal)
          const bytes = bytesForPart(options.bytes, upload.partSize, part.partNumber)
          try {
            const etag = await uploadPartWithRetry(options, controller.signal, part, bytes)
            transferredBytes += bytes.byteLength
            reportProgress(options, transferredBytes)
            return { partNumber: part.partNumber, etag }
          } catch (error) {
            controller.abort(error)
            limit.clearQueue()
            throw error
          }
        })
      )
    )
  } finally {
    options.signal?.removeEventListener('abort', abort)
  }
}

async function uploadPartWithRetry(
  options: CloudObjectUploadOptions,
  signal: AbortSignal,
  part: MultipartPart,
  bytes: Uint8Array
): Promise<string> {
  return pRetry(
    async () => {
      const response = await options.transport.objectFetch(part.url, {
        method: part.method,
        headers: part.headers,
        body: requestBody(bytes),
        signal
      })
      if (response.ok) {
        const etag = response.headers.get('etag')
        if (!etag) throw new AbortError('Cloud multipart upload response did not include an ETag')
        return etag
      }
      const error = new ObjectUploadError('Cloud multipart upload', response.status)
      if (!isRetryableStatus(response.status)) throw new AbortError(error)
      throw error
    },
    {
      retries: MAX_PART_ATTEMPTS - 1,
      factor: 2,
      minTimeout: BASE_RETRY_DELAY_MS,
      randomize: true,
      signal
    }
  )
}

function reportProgress(options: CloudObjectUploadOptions, transferredBytes: number): void {
  options.onProgress?.({ transferredBytes, totalBytes: options.bytes.byteLength })
}

function bytesForPart(bytes: Uint8Array, partSize: number, partNumber: number): Uint8Array {
  const start = (partNumber - 1) * partSize
  return bytes.subarray(start, Math.min(bytes.byteLength, start + partSize))
}

function requestBody(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (bytes.buffer instanceof ArrayBuffer) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  return Uint8Array.from(bytes)
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

function isExpiredPresignedRequest(error: unknown): boolean {
  return error instanceof ObjectUploadError && (error.status === 401 || error.status === 403)
}

function abortError(signal: AbortSignal | undefined): Error {
  return signal?.reason instanceof Error
    ? signal.reason
    : new DOMException('Upload aborted', 'AbortError')
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortError(signal)
}
