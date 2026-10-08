import type { S3Client } from '@aws-sdk/client-s3'

import { storageFetch } from '@/app/integrations/storage/s3/fetch'
import type * as S3SDK from '@/app/integrations/storage/s3/sdk'
import type { S3CompatibleConfig } from '@/app/integrations/storage/s3/types'
import type { LibraryObjectWriteOptions } from '@/app/integrations/storage/types'

/** Error name the SDK gives a reply it could not parse. */
const UNPARSED_ERROR_NAME = 'Unknown'

/** ListObjectsV2 returns at most 1,000 keys per page. */
const LIST_PAGE_LIMIT = 50

export type ListedObject = {
  key: string
  lastModified: string | null
  size: number | null
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

export type UploadProgress = { sentBytes: number; totalBytes: number | null }

/**
 * fetch() cannot observe upload progress — send the signed request over
 * XMLHttpRequest when a progress callback is attached (uploads only).
 */
function xhrFetch(onUploadProgress: (progress: UploadProgress) => void): typeof fetch {
  return async (input) => {
    if (!(input instanceof Request)) throw new TypeError('Expected a signed S3 request')
    // A Blob has a known size, so the browser sends Content-Length (required by B2).
    const body = await input.blob()
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open(input.method, input.url)
      input.headers.forEach((value, key) => {
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
      xhr.send(body)
    })
  }
}

async function send<Output>(
  config: S3CompatibleConfig,
  run: (client: S3Client, sdk: typeof S3SDK) => Promise<Output>,
  customFetch: typeof fetch = storageFetch
): Promise<Output> {
  // Storage is opt-in, so the AWS SDK loads with the first request rather than the editor.
  const sdk = await import('@/app/integrations/storage/s3/sdk')
  try {
    return await run(sdk.createS3Client(config, customFetch), sdk)
  } catch (error) {
    if (error instanceof sdk.S3ServiceException) {
      const status = error.$metadata.httpStatusCode ?? 0
      // HEAD errors and non-XML replies have no body, which the SDK names "Unknown".
      const parsed = error.name !== UNPARSED_ERROR_NAME && error.message !== ''
      throw new S3HttpError(
        status,
        parsed ? error.message : `S3 request failed with status ${status}`,
        parsed ? error.name : null
      )
    }
    // Re-export as a typed error so UI can detect CORS/network blocks.
    const { CloudCORSError, isLikelyCORSOrNetworkError, formatBrowserCORSHelpMessage } =
      await import('@/app/integrations/storage/s3/cors')
    if (isLikelyCORSOrNetworkError(error)) {
      throw new CloudCORSError(formatBrowserCORSHelpMessage())
    }
    throw error
  }
}

async function unlessMissing<Output>(pending: Promise<Output>): Promise<Output | null> {
  try {
    return await pending
  } catch (error) {
    if (error instanceof S3HttpError && error.status === 404) return null
    throw error
  }
}

function headObjectOutput(config: S3CompatibleConfig, key: string) {
  return unlessMissing(
    send(config, (client, sdk) =>
      client.send(new sdk.HeadObjectCommand({ Bucket: config.bucket, Key: key }))
    )
  )
}

export async function headObject(config: S3CompatibleConfig, key: string): Promise<boolean> {
  return (await headObjectOutput(config, key)) != null
}

export async function headObjectSize(
  config: S3CompatibleConfig,
  key: string
): Promise<number | null> {
  const size = (await headObjectOutput(config, key))?.ContentLength
  return size != null && Number.isSafeInteger(size) && size >= 0 ? size : null
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
  const output = await unlessMissing(
    send(config, (client, sdk) =>
      client.send(
        new sdk.GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Range: `bytes=${start}-${endExclusive - 1}`
        })
      )
    )
  )
  if (!output) return null
  // Some servers, such as `rclone serve s3`, send the requested range with 200 instead of 206.
  const honored =
    output.$metadata.httpStatusCode === 206 ||
    output.ContentRange?.startsWith(`bytes ${start}-${endExclusive - 1}/`) === true
  if (!honored || !output.Body) {
    throw new Error('Storage provider did not honor the thumbnail byte range')
  }
  return output.Body.transformToByteArray()
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
  const customFetch =
    onUploadProgress && typeof XMLHttpRequest !== 'undefined'
      ? xhrFetch(onUploadProgress)
      : storageFetch
  await send(
    config,
    (client, sdk) =>
      client.send(
        new sdk.PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: bytes,
          ContentType: contentType,
          IfMatch: options?.ifMatch,
          IfNoneMatch: options?.ifNoneMatch
        })
      ),
    customFetch
  )
}

export async function getObjectValue(
  config: S3CompatibleConfig,
  key: string
): Promise<{ bytes: Uint8Array | null; etag: string | null }> {
  const output = await unlessMissing(
    send(config, (client, sdk) =>
      client.send(new sdk.GetObjectCommand({ Bucket: config.bucket, Key: key }))
    )
  )
  if (!output?.Body) return { bytes: null, etag: null }
  return { bytes: await output.Body.transformToByteArray(), etag: output.ETag ?? null }
}

export type DownloadProgress = { receivedBytes: number; totalBytes: number | null }

export async function readDownloadStream(
  stream: ReadableStream<Uint8Array>,
  totalBytes: number | null,
  onProgress: (progress: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<Uint8Array> {
  signal?.throwIfAborted()
  const reader = stream.getReader()
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
  const output = await unlessMissing(
    send(config, (client, sdk) =>
      client.send(new sdk.GetObjectCommand({ Bucket: config.bucket, Key: key }), {
        abortSignal: signal
      })
    )
  )
  if (!output?.Body) return null
  if (!onProgress) return output.Body.transformToByteArray()
  const totalBytes = output.ContentLength ? output.ContentLength : null
  return readDownloadStream(output.Body.transformToWebStream(), totalBytes, onProgress, signal)
}

export async function deleteObject(config: S3CompatibleConfig, key: string): Promise<void> {
  await unlessMissing(
    send(config, (client, sdk) =>
      client.send(new sdk.DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
    )
  )
}

export async function listObjects(
  config: S3CompatibleConfig,
  prefix: string
): Promise<ListedObject[]> {
  return send(config, async (client, sdk) => {
    const all: ListedObject[] = []
    let pages = 0
    for await (const page of sdk.paginateListObjectsV2(
      { client },
      { Bucket: config.bucket, Prefix: prefix }
    )) {
      for (const object of page.Contents ?? []) {
        if (!object.Key) continue
        all.push({
          key: object.Key,
          lastModified: object.LastModified?.toISOString() ?? null,
          size: object.Size ?? null
        })
      }
      if (++pages === LIST_PAGE_LIMIT && page.IsTruncated) {
        throw new Error('S3 listing exceeded the 50,000-object safety limit')
      }
    }
    return all
  })
}
