import { fromUint8Array } from 'js-base64'

import type { DocumentDownload } from '@open-pencil/cloud/contract'

import type { StorageTransferProgress } from '../types'

export async function cloudChecksum(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))
  return fromUint8Array(new Uint8Array(digest))
}

/** A revision's bytes from the object store, checked against what the server recorded. */
export async function downloadCloudRevision(
  download: DocumentDownload,
  objectFetch: (input: string, init: RequestInit) => Promise<Response>,
  options: { signal?: AbortSignal; onProgress?: (progress: StorageTransferProgress) => void } = {}
): Promise<Uint8Array> {
  const response = await objectFetch(download.download.url, {
    method: download.download.method,
    headers: download.download.headers,
    signal: options.signal
  })
  if (!response.ok) throw new Error(`Cloud document download failed with HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (
    bytes.byteLength !== download.byteSize ||
    (await cloudChecksum(bytes)) !== download.checksum
  ) {
    throw new Error('The downloaded Cloud document does not match what the server stored')
  }
  options.onProgress?.({ transferredBytes: bytes.byteLength, totalBytes: download.byteSize })
  return bytes
}
