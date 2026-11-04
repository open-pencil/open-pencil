import { limitAsync, sumBy } from 'es-toolkit'
import { fromUint8Array } from 'js-base64'

import type { DocumentDownload, DocumentImageLink } from '@open-pencil/cloud/contract'

import type { StorageTransferProgress } from '../types'
import { assembleCloudDocument } from './images'

export async function cloudChecksum(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))
  return fromUint8Array(new Uint8Array(digest))
}

type ObjectFetch = (input: string, init: RequestInit) => Promise<Response>
const IMAGE_DOWNLOAD_CONCURRENCY = 6

/** An object's bytes from the store, checked against the size and checksum the server recorded. */
async function fetchVerified(
  target: DocumentDownload['download'],
  expected: { byteSize: number; checksum: string },
  objectFetch: ObjectFetch,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const response = await objectFetch(target.url, {
    method: target.method,
    headers: target.headers,
    signal
  })
  if (!response.ok) throw new Error(`Cloud document download failed with HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (
    bytes.byteLength !== expected.byteSize ||
    (await cloudChecksum(bytes)) !== expected.checksum
  ) {
    throw new Error('The downloaded Cloud document does not match what the server stored')
  }
  return bytes
}

/** An image a live room names, from where the server linked it, checked against its record. */
export function downloadCloudImage(
  link: DocumentImageLink,
  objectFetch: ObjectFetch,
  signal?: AbortSignal
): Promise<Uint8Array> {
  return fetchVerified(link.download, link, objectFetch, signal)
}

/** A revision as the editor opens it: its stored file with every image put back under its name. */
export async function downloadCloudDocument(
  download: DocumentDownload,
  objectFetch: ObjectFetch,
  options: { signal?: AbortSignal; onProgress?: (progress: StorageTransferProgress) => void } = {}
): Promise<Uint8Array> {
  const totalBytes = download.byteSize + sumBy(download.images, (image) => image.byteSize)
  let transferredBytes = 0
  const received = (bytes: Uint8Array) => {
    transferredBytes += bytes.byteLength
    options.onProgress?.({ transferredBytes, totalBytes })
    return bytes
  }
  const fetchImage = limitAsync(
    async (image: DocumentDownload['images'][number]) => ({
      name: image.name,
      bytes: received(await fetchVerified(image.download, image, objectFetch, options.signal))
    }),
    IMAGE_DOWNLOAD_CONCURRENCY
  )
  const [lean, ...images] = await Promise.all([
    fetchVerified(download.download, download, objectFetch, options.signal).then(received),
    ...download.images.map(fetchImage)
  ])
  return assembleCloudDocument(lean, images)
}

/**
 * Reads exactly `length` bytes of a response, stopping a body that runs past them rather than
 * receiving the rest.
 */
async function readExactly(response: Response, length: number): Promise<Uint8Array> {
  const bytes = new Uint8Array(length)
  let received = 0
  const reader = response.body?.getReader()
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (received + value.byteLength > length) {
        await reader.cancel()
        throw new Error(`Cloud document range read sent more than the ${length} bytes asked for`)
      }
      bytes.set(value, received)
      received += value.byteLength
    }
  }
  if (received !== length) {
    throw new Error(`Cloud document range read sent ${received} of the ${length} bytes asked for`)
  }
  return bytes
}

/**
 * Bytes `start` to `endExclusive` of a revision, for reading its preview without the rest. Only
 * a partial response of exactly that range counts: a store that ignores the range, or answers
 * another one, is stopped rather than left sending the file. `Content-Range` is checked when the
 * store's CORS rules let the browser read it.
 */
export async function readCloudRevisionRange(
  download: DocumentDownload,
  objectFetch: (input: string, init: RequestInit) => Promise<Response>,
  start: number,
  endExclusive: number
): Promise<Uint8Array> {
  const response = await objectFetch(download.download.url, {
    method: download.download.method,
    headers: { ...download.download.headers, Range: `bytes=${start}-${endExclusive - 1}` }
  })
  const range = response.headers.get('Content-Range')
  if (
    response.status !== 206 ||
    (range && !range.startsWith(`bytes ${start}-${endExclusive - 1}/`))
  ) {
    await response.body?.cancel()
    throw new Error(
      `Cloud document range read failed with HTTP ${response.status}${range ? ` (${range})` : ''}`
    )
  }
  return readExactly(response, endExclusive - start)
}
