import type {
  CommitUploadInput,
  DocumentImageDownload,
  DocumentImageLink,
  ImageUploadOffer,
  RequestImageUploadsInput
} from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import type { ObjectStore } from '#cloud/server/objects'
import type { StorageQuotaService } from '#cloud/server/quota'
import { uniq, uniqBy } from 'es-toolkit'
import type { Kysely, Transaction } from 'kysely'

/** Images are stored as the bytes their file holds, whatever format those are. */
export const IMAGE_CONTENT_TYPE = 'application/octet-stream'

type Executor = Kysely<CloudDatabase> | Transaction<CloudDatabase>

/** An image no revision has used for this long may be released; a save uploads first. */
export const IMAGE_RELEASE_GRACE_MS = 24 * 60 * 60_000

/**
 * The images a workspace's documents use, each stored once under the SHA-256 the object store
 * verified, and which of them each stored revision uses under the names its file gives them.
 */
export function createDocumentImages(
  database: Kysely<CloudDatabase>,
  objects: ObjectStore,
  quota: StorageQuotaService
) {
  /**
   * Gives up uploads a request reserved when it could not offer them all, so a retry is not
   * refused for space they hold. A multipart upload the store began is aborted first; one that
   * cannot be stays pending for cleanup, which aborts it once it expires.
   */
  async function abandonUploads(
    uploads: readonly { uploadId: string; objectKey: string }[],
    offers: readonly ImageUploadOffer[]
  ): Promise<void> {
    const begun = new Map(offers.map((offer) => [offer.uploadId, offer.upload]))
    for (const { uploadId, objectKey } of uploads) {
      try {
        const upload = begun.get(uploadId)
        if (upload?.kind === 'multipart') {
          await objects.abortUpload({ key: objectKey, uploadId: upload.uploadId })
        }
        await quota.release(uploadId)
        await database
          .updateTable('upload')
          .set({ status: 'abandoned' })
          .where('id', '=', uploadId)
          .where('status', '=', 'pending')
          .execute()
      } catch (error) {
        // Cleanup releases it once it expires.
        console.warn('Giving up an image upload failed', error)
      }
    }
  }

  return {
    /**
     * Uploads for the images of `input` the workspace lacks, each with its own object key and
     * reservation, so an abandoned one is cleaned up like any other upload. Images it holds
     * already need nothing.
     */
    async requestUploads(input: {
      userId: string
      documentId: string
      workspaceId: string
      images: RequestImageUploadsInput['images']
      expiresAt: Date
      maximumBytes: number | null
    }): Promise<ImageUploadOffer[]> {
      const requested = uniqBy(input.images, (image) => image.checksum)
      // Held images are renewed, so none is released before the save that asked commits.
      const held = new Set(
        (
          await database
            .updateTable('workspaceImage')
            .set({ touchedAt: new Date() })
            .where('workspaceId', '=', input.workspaceId)
            .where(
              'checksum',
              'in',
              requested.map((image) => image.checksum)
            )
            .returning('checksum')
            .execute()
        ).map((row) => row.checksum)
      )
      const missing = requested
        .filter((image) => !held.has(image.checksum))
        .map((image) => {
          const uploadId = crypto.randomUUID()
          return {
            ...image,
            uploadId,
            objectKey: `documents/${input.workspaceId}/images/${uploadId}`
          }
        })
      if (missing.length === 0) return []
      await database.transaction().execute(async (transaction) => {
        for (const image of missing) {
          await transaction
            .insertInto('upload')
            .values({
              id: image.uploadId,
              kind: 'image',
              documentId: input.documentId,
              baseRevisionId: null,
              objectKey: image.objectKey,
              checksum: image.checksum,
              byteSize: image.byteSize,
              contentType: IMAGE_CONTENT_TYPE,
              multipartUploadId: null,
              status: 'pending',
              finalizationStartedAt: null,
              createdBy: input.userId,
              expiresAt: input.expiresAt
            })
            .execute()
          await quota.reserveInTransaction(transaction, {
            workspaceId: input.workspaceId,
            uploadId: image.uploadId,
            bytes: image.byteSize,
            expiresAt: input.expiresAt,
            maximumBytes: input.maximumBytes
          })
        }
      })
      const offers: ImageUploadOffer[] = []
      try {
        for (const image of missing) {
          const upload = await objects.createUpload({
            key: image.objectKey,
            byteSize: image.byteSize,
            checksum: image.checksum,
            contentType: IMAGE_CONTENT_TYPE,
            expiresAt: input.expiresAt
          })
          offers.push({ checksum: image.checksum, uploadId: image.uploadId, upload })
          if (upload.kind === 'multipart') {
            await database
              .updateTable('upload')
              .set({ multipartUploadId: upload.uploadId })
              .where('id', '=', image.uploadId)
              .execute()
          }
        }
      } catch (error) {
        await abandonUploads(missing, offers)
        throw error
      }
      return offers
    },

    /**
     * Stores a verified image upload as the workspace's copy of that image. When another upload of
     * the same bytes got there first, this one's file is left unreferenced for cleanup to delete
     * and its reservation is released rather than counted twice.
     */
    async landInTransaction(
      transaction: Transaction<CloudDatabase>,
      input: {
        uploadId: string
        workspaceId: string
        objectKey: string
        stored: { checksum: string; byteSize: number; contentType: string }
      }
    ): Promise<void> {
      const storageObjectId = crypto.randomUUID()
      await transaction
        .insertInto('storageObject')
        .values({
          id: storageObjectId,
          objectKey: input.objectKey,
          checksum: input.stored.checksum,
          byteSize: input.stored.byteSize,
          contentType: input.stored.contentType
        })
        .execute()
      const landed = await transaction
        .insertInto('workspaceImage')
        .values({
          workspaceId: input.workspaceId,
          checksum: input.stored.checksum,
          storageObjectId
        })
        .onConflict((conflict) => conflict.columns(['workspaceId', 'checksum']).doNothing())
        .returning('checksum')
        .executeTakeFirst()
      await transaction
        .updateTable('upload')
        .set({ status: 'committed', finalizationStartedAt: null })
        .where('id', '=', input.uploadId)
        .execute()
      if (landed) await quota.commitInTransaction(transaction, input.uploadId)
      else await quota.releaseInTransaction(transaction, input.uploadId)
    },

    /**
     * Records the images a new revision uses. Each must be the workspace's already; holding them
     * until the revision refers to them keeps a release of an unused image from racing the save.
     * Whether every image was there.
     */
    async attachInTransaction(
      transaction: Transaction<CloudDatabase>,
      input: { workspaceId: string; revisionId: string; images: CommitUploadInput['images'] }
    ): Promise<boolean> {
      const images = uniqBy(input.images, (image) => image.name)
      if (images.length === 0) return true
      const checksums = uniq(images.map((image) => image.checksum))
      const held = await transaction
        .selectFrom('workspaceImage')
        .select('checksum')
        .where('workspaceId', '=', input.workspaceId)
        .where('checksum', 'in', checksums)
        .forShare()
        .execute()
      if (held.length !== checksums.length) return false
      await transaction
        .insertInto('revisionImage')
        .values(
          images.map((image) => ({
            revisionId: input.revisionId,
            name: image.name,
            workspaceId: input.workspaceId,
            checksum: image.checksum
          }))
        )
        .execute()
      return true
    }
  }
}

export type DocumentImages = ReturnType<typeof createDocumentImages>

/** Gives a revision made from another, by a restore or a duplicate, the same images. */
export async function copyRevisionImages(
  transaction: Transaction<CloudDatabase>,
  fromRevisionId: string,
  toRevisionId: string
): Promise<void> {
  await transaction
    .insertInto('revisionImage')
    .columns(['revisionId', 'name', 'workspaceId', 'checksum'])
    .expression((expression) =>
      expression
        .selectFrom('revisionImage')
        .select((select) => [
          select.val(toRevisionId).as('revisionId'),
          'name',
          'workspaceId',
          'checksum'
        ])
        .where('revisionId', '=', fromRevisionId)
    )
    .execute()
}

/** Where to download each image a revision uses, under its name in the file. */
export async function revisionImageDownloads(
  executor: Executor,
  objects: ObjectStore,
  revisionId: string,
  expiresAt: Date
): Promise<DocumentImageDownload[]> {
  const rows = await executor
    .selectFrom('revisionImage')
    .innerJoin('workspaceImage', (join) =>
      join
        .onRef('workspaceImage.workspaceId', '=', 'revisionImage.workspaceId')
        .onRef('workspaceImage.checksum', '=', 'revisionImage.checksum')
    )
    .innerJoin('storageObject', 'storageObject.id', 'workspaceImage.storageObjectId')
    .select([
      'revisionImage.name',
      'revisionImage.checksum',
      'storageObject.objectKey',
      'storageObject.byteSize'
    ])
    .where('revisionImage.revisionId', '=', revisionId)
    .orderBy('revisionImage.name')
    .execute()
  return Promise.all(
    rows.map(async (row) => ({
      name: row.name,
      checksum: row.checksum,
      byteSize: Number(row.byteSize),
      download: await objects.createDownload({ key: row.objectKey, expiresAt })
    }))
  )
}

/**
 * Releases up to `batchSize` images no revision uses that no save has asked for since `before`:
 * their bytes go back to the workspace's usage, and their files, no longer anyone's, are left for
 * the object sweep. A save holds the images it refers to, so it either lands first and keeps them
 * or finds them gone and uploads them again. How many were released and their bytes.
 */
export async function releaseUnusedImages(
  database: Kysely<CloudDatabase>,
  before: Date,
  batchSize: number
): Promise<{ released: number; bytes: number }> {
  return database.transaction().execute(async (transaction) => {
    const unused = await transaction
      .selectFrom('workspaceImage')
      .innerJoin('storageObject', 'storageObject.id', 'workspaceImage.storageObjectId')
      .select(['workspaceImage.workspaceId', 'workspaceImage.checksum', 'storageObject.byteSize'])
      .where('workspaceImage.touchedAt', '<', before)
      .where((expression) =>
        expression.not(
          expression.exists(
            expression
              .selectFrom('revisionImage')
              .select('revisionImage.name')
              .whereRef('revisionImage.workspaceId', '=', 'workspaceImage.workspaceId')
              .whereRef('revisionImage.checksum', '=', 'workspaceImage.checksum')
          )
        )
      )
      .limit(batchSize)
      .forUpdate('workspaceImage')
      .skipLocked()
      .execute()
    let bytes = 0
    for (const image of unused) {
      await transaction
        .deleteFrom('workspaceImage')
        .where('workspaceId', '=', image.workspaceId)
        .where('checksum', '=', image.checksum)
        .execute()
      await transaction
        .updateTable('workspaceStorageUsage')
        .set({
          committedBytes: (expression) => expression('committedBytes', '-', Number(image.byteSize)),
          updatedAt: new Date()
        })
        .where('workspaceId', '=', image.workspaceId)
        .execute()
      bytes += Number(image.byteSize)
    }
    return { released: unused.length, bytes }
  })
}

/**
 * Where to download the images of `checksums` the document's workspace holds, for someone who may
 * view the document. A live room names images by checksum before any save does, and an editor
 * whose image the workspace already holds through another document uploads nothing for this one,
 * so the workspace, not the document, is what an image belongs to. Asking needs the image's
 * SHA-256, which only someone with its bytes has.
 */
export async function documentImageLinks(
  executor: Executor,
  objects: ObjectStore,
  input: { documentId: string; checksums: string[]; expiresAt: Date }
): Promise<DocumentImageLink[]> {
  const rows = await executor
    .selectFrom('workspaceImage')
    .innerJoin('document', 'document.workspaceId', 'workspaceImage.workspaceId')
    .innerJoin('storageObject', 'storageObject.id', 'workspaceImage.storageObjectId')
    .select(['workspaceImage.checksum', 'storageObject.objectKey', 'storageObject.byteSize'])
    .where('document.id', '=', input.documentId)
    .where('workspaceImage.checksum', 'in', uniq(input.checksums))
    .execute()
  return Promise.all(
    rows.map(async (row) => ({
      checksum: row.checksum,
      byteSize: Number(row.byteSize),
      download: await objects.createDownload({ key: row.objectKey, expiresAt: input.expiresAt })
    }))
  )
}

/** The images the workspace's current revisions use, each counted once however many use it. */
export async function currentImageUsage(
  executor: Executor,
  workspaceId: string
): Promise<{ objectCount: number; bytesUsed: number }> {
  const usage = await executor
    .selectFrom('workspaceImage')
    .innerJoin('storageObject', 'storageObject.id', 'workspaceImage.storageObjectId')
    .select((expression) => [
      expression.fn.count('storageObject.id').as('objectCount'),
      expression.fn
        .coalesce(expression.fn.sum('storageObject.byteSize'), expression.val(0))
        .as('bytesUsed')
    ])
    .where('workspaceImage.workspaceId', '=', workspaceId)
    .where((expression) =>
      expression.exists(
        expression
          .selectFrom('revisionImage')
          .innerJoin('document', 'document.currentRevisionId', 'revisionImage.revisionId')
          .select('revisionImage.name')
          .whereRef('revisionImage.workspaceId', '=', 'workspaceImage.workspaceId')
          .whereRef('revisionImage.checksum', '=', 'workspaceImage.checksum')
          .where('document.deletedAt', 'is', null)
      )
    )
    .executeTakeFirstOrThrow()
  return { objectCount: Number(usage.objectCount), bytesUsed: Number(usage.bytesUsed) }
}
