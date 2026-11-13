import type { DocumentSummary } from '#cloud/contract'

import { CloudAPIError, type CloudAPIClient } from '../api'
import { splitCloudDocument } from './archive'
import { cloudChecksum } from './checksum'
import { uploadCloudImages } from './images'
import { uploadCloudObject, type CloudObjectFetch, type CloudTransferProgress } from './objects'

/**
 * A `.fig` as Cloud stores it: the file without its images, which the workspace keeps once, with
 * the checksum of each. The lean file's checksum is the revision's, so an unchanged file is known
 * before anything is sent.
 */
export type PreparedCloudDocument = {
  lean: Uint8Array
  checksum: string
  images: { name: string; bytes: Uint8Array; checksum: string }[]
}

export async function prepareCloudDocument(bytes: Uint8Array): Promise<PreparedCloudDocument> {
  const { lean, images } = await splitCloudDocument(bytes)
  return {
    lean,
    checksum: await cloudChecksum(lean),
    images: await Promise.all(
      images.map(async (image) => ({ ...image, checksum: await cloudChecksum(image.bytes) }))
    )
  }
}

/** The server refused the save as declared, as when an image it named was released meanwhile. */
function invalidUpload(error: unknown): boolean {
  return error instanceof CloudAPIError && error.code === 'invalid_upload'
}

/**
 * Saves a document as a new revision on top of `baseRevision`, or as its first: the images the
 * workspace lacks, then the file, committed together. An image released between asking and
 * committing is uploaded again by a second try. A save on top of a revision that is no longer the
 * latest fails with a `revision_conflict` `CloudAPIError`.
 */
export async function saveCloudDocument(input: {
  cloud: Pick<
    CloudAPIClient,
    'requestImageUploads' | 'commitImageUploads' | 'createUpload' | 'commitUpload'
  >
  documentId: string
  document: PreparedCloudDocument
  name: string
  kind: DocumentSummary['kind']
  baseRevision: string | null
  objectFetch: CloudObjectFetch
  onProgress?: (progress: CloudTransferProgress) => void
}): Promise<DocumentSummary> {
  const { cloud, documentId, document, objectFetch } = input
  const save = async () => {
    await uploadCloudImages({ cloud, documentId, images: document.images, objectFetch })
    const upload = await uploadCloudObject({
      cloud,
      documentId,
      bytes: document.lean,
      checksum: document.checksum,
      baseRevision: input.baseRevision,
      objectFetch,
      onProgress: input.onProgress
    })
    return cloud.commitUpload(upload.uploadId, {
      checksum: document.checksum,
      name: input.name,
      kind: input.kind,
      multipart: upload.multipart,
      images: document.images.map((image) => ({ name: image.name, checksum: image.checksum }))
    })
  }
  return save().catch((error: unknown) => {
    if (invalidUpload(error)) return save()
    throw error
  })
}
