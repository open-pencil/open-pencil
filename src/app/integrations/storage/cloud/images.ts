import { limitAsync } from 'es-toolkit'

import type { CloudAPIClient } from '@open-pencil/cloud/client'
import {
  CLOUD_API_MAX_BODY_BYTES,
  CLOUD_IMAGE_NAME_PATTERN,
  type ObjectUploadTarget
} from '@open-pencil/cloud/contract'
import {
  readStreamBytes,
  readZipDirectory,
  zipEntryContents,
  zipStream,
  type ZipEntry,
  type ZipStreamEntry
} from '@open-pencil/fig'

import { putCloudObject, type CloudObjectTransfer } from './upload'

/** Where a `.fig` archive keeps its images, each under the name its paints refer to. */
const IMAGE_ENTRY_PREFIX = 'images/'
const IMAGE_UPLOAD_CONCURRENCY = 4
/** How much of a request one image commit may fill: each upload brings its parts' ETags. */
const IMAGE_COMMIT_BYTES = CLOUD_API_MAX_BODY_BYTES / 2

/** Uploads in commits that each stay under `IMAGE_COMMIT_BYTES` once sent. */
export function imageCommitBatches<T>(uploads: readonly T[]): T[][] {
  const batches: T[][] = []
  let batch: T[] = []
  let bytes = 0
  for (const upload of uploads) {
    const size = new TextEncoder().encode(JSON.stringify(upload)).byteLength + 1
    if (batch.length > 0 && bytes + size > IMAGE_COMMIT_BYTES) {
      batches.push(batch)
      batch = []
      bytes = 0
    }
    batch.push(upload)
    bytes += size
  }
  if (batch.length > 0) batches.push(batch)
  return batches
}

/** An image a `.fig` archive holds, as Cloud stores it apart from the file. */
export type CloudDocumentImage = { name: string; bytes: Uint8Array }

function archiveEntry(bytes: Uint8Array, entry: ZipEntry): ZipStreamEntry {
  return { name: entry.name, data: zipEntryContents(bytes, entry), deflate: entry.method !== 0 }
}

/**
 * The archive without its images, and the images, as views of `bytes`. A file that is not a zip
 * archive, or holds no images, comes back whole; an image under a name Cloud does not store
 * apart stays inside.
 */
export async function splitCloudDocument(
  bytes: Uint8Array
): Promise<{ lean: Uint8Array; images: CloudDocumentImage[] }> {
  const entries = readZipDirectory(bytes)
  if (!entries) return { lean: bytes, images: [] }
  const images: CloudDocumentImage[] = []
  const rest: ZipStreamEntry[] = []
  for (const entry of entries) {
    const name = entry.name.startsWith(IMAGE_ENTRY_PREFIX)
      ? entry.name.slice(IMAGE_ENTRY_PREFIX.length)
      : null
    // An empty image, or one under a name Cloud does not take, stays inside the file.
    if (name && CLOUD_IMAGE_NAME_PATTERN.test(name) && entry.size > 0) {
      images.push({ name, bytes: zipEntryContents(bytes, entry) })
    } else rest.push(archiveEntry(bytes, entry))
  }
  if (images.length === 0) return { lean: bytes, images }
  return { lean: await readStreamBytes(zipStream(rest)), images }
}

/** The archive with its images put back under their names; the lean archive when there are none. */
export async function assembleCloudDocument(
  lean: Uint8Array,
  images: CloudDocumentImage[]
): Promise<Uint8Array> {
  const entries = images.length === 0 ? null : readZipDirectory(lean)
  if (!entries) return lean
  return readStreamBytes(
    zipStream([
      ...entries.map((entry) => archiveEntry(lean, entry)),
      ...images.map((image) => ({ name: `${IMAGE_ENTRY_PREFIX}${image.name}`, data: image.bytes }))
    ])
  )
}

/**
 * Uploads the images the document's workspace lacks: the server answers with uploads for those
 * only, and they are committed together once their bytes are in place.
 */
export async function uploadCloudImages(input: {
  cloud: Pick<CloudAPIClient, 'requestImageUploads' | 'commitImageUploads'>
  documentId: string
  images: { checksum: string; bytes: Uint8Array }[]
  objectFetch: CloudObjectTransfer['objectFetch']
  signal?: AbortSignal
}): Promise<void> {
  if (input.images.length === 0) return
  const byChecksum = new Map(input.images.map((image) => [image.checksum, image.bytes]))
  const offers = await input.cloud.requestImageUploads(input.documentId, {
    images: [...byChecksum].map(([checksum, bytes]) => ({ checksum, byteSize: bytes.byteLength }))
  })
  if (offers.length === 0) return
  const put = limitAsync(
    (target: ObjectUploadTarget, bytes: Uint8Array) =>
      putCloudObject(target, { bytes, objectFetch: input.objectFetch, signal: input.signal }),
    IMAGE_UPLOAD_CONCURRENCY
  )
  const uploaded = await Promise.all(
    offers.map(async (offer) => {
      const bytes = byChecksum.get(offer.checksum)
      if (!bytes) throw new Error('The server offered an upload for an image this save lacks')
      const multipart = await put(offer.upload, bytes)
      return { uploadId: offer.uploadId, checksum: offer.checksum, multipart }
    })
  )
  // As few commits as fit the server's body limit, in turn, however many images a save adds.
  for (const batch of imageCommitBatches(uploaded)) {
    await input.cloud.commitImageUploads(input.documentId, batch)
  }
}
