import { CLOUD_API_MAX_BODY_BYTES, type ObjectUploadTarget } from '#cloud/contract'
import { limitAsync } from 'es-toolkit'

import type { CloudAPIClient } from '../api'
import { putCloudObject, type CloudObjectFetch } from './objects'

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

/**
 * Uploads the images the document's workspace lacks: the server answers with uploads for those
 * only, and they are committed together once their bytes are in place.
 */
export async function uploadCloudImages(input: {
  cloud: Pick<CloudAPIClient, 'requestImageUploads' | 'commitImageUploads'>
  documentId: string
  images: { checksum: string; bytes: Uint8Array }[]
  objectFetch: CloudObjectFetch
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
