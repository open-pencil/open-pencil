import { responseJSON } from '#cloud-tests/helpers/response'
import type { CloudDatabase, createCloudApp, ObjectStore } from '#cloud/server'
import { zipSync } from 'fflate'
import type { testClient } from 'hono/testing'
import { fromUint8Array, toUint8Array } from 'js-base64'
import type { Kysely } from 'kysely'
import * as v from 'valibot'

/** A 2×2 PNG, the smallest thumbnail the reader takes for one. */
export const THUMBNAIL_PNG = toUint8Array(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGP4z8DwH4QZYAwAR8oH+WdZbrcAAAAASUVORK5CYII='
)

const documentSchema = v.object({
  document: v.object({ id: v.string(), currentRevisionId: v.nullable(v.string()) })
})
const idSchema = v.object({ id: v.string() })

async function sha256(bytes: Uint8Array): Promise<string> {
  return fromUint8Array(
    new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)))
  )
}

/** Where a test saves documents: a signed-in client of the app, its database, and its storage. */
export type DocumentSaver = {
  client: ReturnType<typeof testClient<ReturnType<typeof createCloudApp>>>
  database: Kysely<CloudDatabase>
  objects: ObjectStore
}

/**
 * Saves a document the way the editor does, as a file that carries `THUMBNAIL_PNG`, and answers
 * the revision it made. `label` makes each save's bytes differ.
 */
export async function saveDocument(
  { client, database, objects }: DocumentSaver,
  documentId: string,
  baseRevisionId: string | null,
  label: string
): Promise<string> {
  const bytes = zipSync({
    'canvas.fig': new TextEncoder().encode(label),
    'thumbnail.png': THUMBNAIL_PNG
  })
  const checksum = await sha256(bytes)
  const upload = await responseJSON(
    await client.api.documents[':documentId'].uploads.$post({
      param: { documentId },
      json: {
        baseRevisionId,
        byteSize: bytes.byteLength,
        checksum,
        contentType: 'application/octet-stream'
      }
    }),
    idSchema
  )
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
  const committed = await responseJSON(
    await client.api.uploads[':uploadId'].commit.$post({
      param: { uploadId: upload.id },
      json: { checksum }
    }),
    documentSchema
  )
  const revision = committed.document.currentRevisionId
  if (!revision) throw new Error('The save left no revision')
  return revision
}
