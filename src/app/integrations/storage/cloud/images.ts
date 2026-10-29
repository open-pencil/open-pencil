import { limitAsync } from 'es-toolkit'
import { unzipSync, zipSync, type Zippable } from 'fflate'

import type { CloudAPIClient } from '@open-pencil/cloud/client'
import { CLOUD_IMAGE_NAME_PATTERN, type ObjectUploadTarget } from '@open-pencil/cloud/contract'

import { putCloudObject, type CloudObjectTransfer } from './upload'

/** Where a `.fig` archive keeps its images, each under the name its paints refer to. */
const IMAGE_ENTRY_PREFIX = 'images/'
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]
const IMAGE_UPLOAD_CONCURRENCY = 4

/** An image a `.fig` archive holds, as Cloud stores it apart from the file. */
export type CloudDocumentImage = { name: string; bytes: Uint8Array }

function isZip(bytes: Uint8Array): boolean {
  return ZIP_SIGNATURE.every((byte, index) => bytes[index] === byte)
}

/**
 * The archive without its images, and the images. A file that is not a zip archive, or holds no
 * images, comes back whole; an image under a name Cloud does not store apart stays inside.
 */
export function splitCloudDocument(bytes: Uint8Array): {
  lean: Uint8Array
  images: CloudDocumentImage[]
} {
  if (!isZip(bytes)) return { lean: bytes, images: [] }
  const entries = unzipSync(bytes)
  const images: CloudDocumentImage[] = []
  const rest: Zippable = {}
  for (const [path, data] of Object.entries(entries)) {
    const name = path.startsWith(IMAGE_ENTRY_PREFIX) ? path.slice(IMAGE_ENTRY_PREFIX.length) : null
    // An empty image, or one under a name Cloud does not take, stays inside the file.
    if (name && CLOUD_IMAGE_NAME_PATTERN.test(name) && data.byteLength > 0) {
      images.push({ name, bytes: data })
    } else rest[path] = [data, { level: 0 }]
  }
  return images.length === 0 ? { lean: bytes, images } : { lean: zipSync(rest), images }
}

/** The archive with its images put back under their names; the lean archive when there are none. */
export function assembleCloudDocument(lean: Uint8Array, images: CloudDocumentImage[]): Uint8Array {
  if (images.length === 0) return lean
  const entries: Zippable = {}
  for (const [path, data] of Object.entries(unzipSync(lean))) entries[path] = [data, { level: 0 }]
  for (const image of images) {
    entries[`${IMAGE_ENTRY_PREFIX}${image.name}`] = [image.bytes, { level: 0 }]
  }
  return zipSync(entries)
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
  // One commit for every image, however many a save adds.
  await input.cloud.commitImageUploads(input.documentId, uploaded)
}
