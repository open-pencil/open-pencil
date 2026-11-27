import type { CloudContractClient } from '#cloud/client/contract'
import type { CloudDatabase, ObjectStore } from '#cloud/server'
import { zipSync } from 'fflate'
import { fromUint8Array, toUint8Array } from 'js-base64'
import type { Kysely } from 'kysely'

/** A 2×2 PNG, the smallest thumbnail the reader takes for one. */
export const THUMBNAIL_PNG = toUint8Array(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGP4z8DwH4QZYAwAR8oH+WdZbrcAAAAASUVORK5CYII='
)

/** A 4×2 PNG, a cover a save can draw: small, and unlike `THUMBNAIL_PNG`. */
export const COVER_PNG = toUint8Array(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAAEElEQVR4nGP4z8AARwzIHABvqgf5gNwAKAAAAABJRU5ErkJggg=='
)

async function sha256(bytes: Uint8Array): Promise<string> {
  return fromUint8Array(
    new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)))
  )
}

/** Where a test saves documents: a signed-in client of the app, its database, and its storage. */
export type DocumentSaver = {
  api: CloudContractClient
  database: Kysely<CloudDatabase>
  objects: ObjectStore
}

/** Uploads `bytes` as an image of the document's workspace, as a save uploads its cover. */
async function uploadImage(
  { api, database, objects }: DocumentSaver,
  documentId: string,
  bytes: Uint8Array
): Promise<string> {
  const checksum = await sha256(bytes)
  const offers = await api.documents.requestImageUploads({
    params: { documentId },
    body: { images: [{ checksum, byteSize: bytes.byteLength }] }
  })
  for (const offer of offers.uploads) {
    const row = await database
      .selectFrom('upload')
      .select('objectKey')
      .where('id', '=', offer.uploadId)
      .executeTakeFirstOrThrow()
    await objects.write({
      key: row.objectKey,
      bytes,
      checksum,
      contentType: 'application/octet-stream'
    })
  }
  if (offers.uploads.length > 0) {
    await api.documents.commitImageUploads({
      params: { documentId },
      body: { uploads: offers.uploads.map(({ uploadId }) => ({ uploadId, checksum })) }
    })
  }
  return checksum
}

/**
 * Saves a document the way the editor does, as a file that carries `THUMBNAIL_PNG`, with `cover`
 * as the cover the save drew when given, and answers the revision it made. `label` makes each
 * save's bytes differ.
 */
export async function saveDocument(
  saver: DocumentSaver,
  documentId: string,
  baseRevisionId: string | null,
  label: string,
  cover?: Uint8Array
): Promise<string> {
  const { api, database, objects } = saver
  const coverChecksum = cover ? await uploadImage(saver, documentId, cover) : undefined
  const bytes = zipSync({
    'canvas.fig': new TextEncoder().encode(label),
    'thumbnail.png': THUMBNAIL_PNG
  })
  const checksum = await sha256(bytes)
  const upload = await api.documents.createUpload({
    params: { documentId },
    body: {
      baseRevisionId,
      byteSize: bytes.byteLength,
      checksum,
      contentType: 'application/octet-stream'
    }
  })
  const row = await database
    .selectFrom('upload')
    .select('objectKey')
    .where('id', '=', upload.id)
    .executeTakeFirstOrThrow()
  await objects.write({
    key: row.objectKey,
    bytes,
    checksum,
    contentType: 'application/octet-stream'
  })
  const committed = await api.documents.commitUpload({
    params: { uploadId: upload.id },
    body: { checksum, cover: coverChecksum }
  })
  const revision = committed.document.currentRevisionId
  if (!revision) throw new Error('The save left no revision')
  return revision
}
