import type {
  CommitImageUploadsInput,
  CommitUploadInput,
  CreateDocumentInput,
  CreateUploadInput,
  DocumentDownload,
  DocumentSummary,
  ImageUploadOffer,
  RequestImageUploadsInput,
  SharedDocument
} from '#cloud/contract'
import { createUploadCleanupService } from '#cloud/server/cleanup'
import type { CloudDatabase } from '#cloud/server/db'
import {
  canDeleteDocument,
  canEditDocument,
  resolveDocumentAccess
} from '#cloud/server/documents/access'
import {
  DocumentConflictError,
  DocumentForbiddenError,
  DocumentNotFoundError,
  UploadInvalidError
} from '#cloud/server/documents/errors'
import {
  createDocumentImages,
  currentImageUsage,
  documentImageLinks,
  revisionImageDownloads
} from '#cloud/server/documents/images'
import { writableDocument } from '#cloud/server/documents/limits'
import {
  findDocument,
  insertDocument,
  listDocuments,
  listSharedDocuments,
  workspaceRole
} from '#cloud/server/documents/repository'
import { documentSummary, getDocumentSummaryRow } from '#cloud/server/documents/summary'
import type { CreateDocumentUploadResult } from '#cloud/server/documents/types'
import { announceVersions, recordCheckpoint } from '#cloud/server/documents/versions/checkpoint'
import type { ObjectStore, StoredObject } from '#cloud/server/objects'
import type { CloudPolicy } from '#cloud/server/policy/policy'
import { createStorageQuotaService } from '#cloud/server/quota'
import { isUndefined, limitAsync, omitBy, uniq, uniqBy } from 'es-toolkit'
import type { Kysely, Transaction } from 'kysely'

const DOWNLOAD_LIFETIME_MS = 5 * 60 * 1000
const UPLOAD_LIFETIME_MS = 15 * 60 * 1000
/** How many of a save's images are checked and landed at once. */
const IMAGE_COMMIT_CONCURRENCY = 8
const WRITABLE_ROLES = new Set(['admin', 'editor'])

export type DocumentServiceOptions = {
  policy?: CloudPolicy
  technicalMaximumUploadBytes?: number
  /** Called once a save adds a checkpoint to the document's history. */
  onVersionsChanged?: (documentId: string) => void
}

/** Whether the stored object is the file the upload declared, which the commit names again. */
function matchesUpload(
  stored: { checksum: string; byteSize: number; contentType: string },
  upload: { checksum: string; byteSize: number | string | bigint; contentType: string }
): boolean {
  return (
    stored.checksum === upload.checksum &&
    stored.byteSize === Number(upload.byteSize) &&
    stored.contentType === upload.contentType
  )
}

export function createDocumentService(
  database: Kysely<CloudDatabase>,
  objects: ObjectStore,
  options: DocumentServiceOptions = {}
) {
  const cleanup = createUploadCleanupService(database, objects)
  const quota = createStorageQuotaService(database)
  const images = createDocumentImages(database, objects, quota)

  /**
   * Makes a committed upload the document's current revision, unless it already was, and records
   * the checkpoint the save adds, if any. Whether the history gained one.
   */
  async function landRevision(
    transaction: Transaction<CloudDatabase>,
    {
      userId,
      uploadId,
      upload,
      stored,
      revisionId,
      storageObjectId,
      images: revisionImages,
      name,
      kind
    }: {
      userId: string
      uploadId: string
      upload: {
        documentId: string
        workspaceId: string
        baseRevisionId: string | null
        objectKey: string
      }
      stored: { checksum: string; byteSize: number; contentType: string }
      revisionId: string
      storageObjectId: string
      images: CommitUploadInput['images']
      name: CommitUploadInput['name']
      kind: CommitUploadInput['kind']
    }
  ): Promise<boolean> {
    const lockedUpload = await transaction
      .selectFrom('upload')
      .select('status')
      .where('id', '=', uploadId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (lockedUpload.status === 'committed') return false
    if (lockedUpload.status !== 'finalizing') throw new UploadInvalidError()
    const document = await transaction
      .selectFrom('document')
      .select(['currentRevisionId'])
      .where('id', '=', upload.documentId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (document.currentRevisionId !== upload.baseRevisionId) {
      throw new DocumentConflictError()
    }
    await transaction
      .insertInto('storageObject')
      .values({
        id: storageObjectId,
        objectKey: upload.objectKey,
        checksum: stored.checksum,
        byteSize: stored.byteSize,
        contentType: stored.contentType
      })
      .execute()
    await transaction
      .insertInto('documentRevision')
      .values({
        id: revisionId,
        documentId: upload.documentId,
        parentRevisionId: upload.baseRevisionId,
        storageObjectId,
        createdBy: userId
      })
      .execute()
    const attached = await images.attachInTransaction(transaction, {
      workspaceId: upload.workspaceId,
      revisionId,
      images: revisionImages
    })
    if (!attached) throw new UploadInvalidError()
    await transaction
      .updateTable('document')
      .set({
        // A revision may also retitle its document, or say the file it holds is a board.
        ...omitBy({ name, kind }, isUndefined),
        currentRevisionId: revisionId,
        version: (expression) => expression('version', '+', 1)
      })
      .where('id', '=', upload.documentId)
      .execute()
    const checkpointed = await recordCheckpoint(transaction, {
      documentId: upload.documentId,
      previousRevisionId: document.currentRevisionId,
      revisionId,
      userId,
      now: new Date()
    })
    await transaction
      .updateTable('upload')
      .set({ status: 'committed', finalizationStartedAt: null })
      .where('id', '=', uploadId)
      .execute()
    await quota.commitInTransaction(transaction, uploadId)
    return checkpointed
  }

  /** Links for images a live room names, by checksum. */
  async function imageLinksOf(documentId: string, checksums: string[]) {
    const expiresAt = new Date(Date.now() + DOWNLOAD_LIFETIME_MS)
    return {
      images: await documentImageLinks(database, objects, { documentId, checksums, expiresAt })
    }
  }

  async function createDownload(documentId: string): Promise<DocumentDownload> {
    const row = await getDocumentSummaryRow(database, documentId)
    if (!row?.currentRevisionId) throw new DocumentNotFoundError()
    const document: DocumentSummary = documentSummary(row)
    const revision = await database
      .selectFrom('documentRevision')
      .innerJoin('storageObject', 'storageObject.id', 'documentRevision.storageObjectId')
      .select([
        'documentRevision.id as revisionId',
        'storageObject.objectKey',
        'storageObject.byteSize',
        'storageObject.checksum',
        'storageObject.contentType'
      ])
      .where('documentRevision.id', '=', document.currentRevisionId)
      .where('documentRevision.documentId', '=', documentId)
      .executeTakeFirst()
    if (!revision) throw new DocumentNotFoundError()
    const expiresAt = new Date(Date.now() + DOWNLOAD_LIFETIME_MS)
    return {
      document,
      revisionId: revision.revisionId,
      byteSize: Number(revision.byteSize),
      checksum: revision.checksum,
      contentType: revision.contentType,
      download: await objects.createDownload({ key: revision.objectKey, expiresAt }),
      images: await revisionImageDownloads(database, objects, revision.revisionId, expiresAt)
    }
  }

  /** What committing an upload reads of it and its document. */
  function selectUploads() {
    return database
      .selectFrom('upload')
      .innerJoin('document', 'document.id', 'upload.documentId')
      .select([
        'upload.id',
        'upload.documentId',
        'upload.kind',
        'document.workspaceId',
        'upload.baseRevisionId',
        'upload.objectKey',
        'upload.checksum',
        'upload.byteSize',
        'upload.contentType',
        'upload.multipartUploadId',
        'upload.status',
        'upload.expiresAt'
      ])
  }
  type UploadRow = Awaited<ReturnType<ReturnType<typeof selectUploads>['executeTakeFirstOrThrow']>>

  /**
   * Claims a pending upload, completes it when it came in parts, checks the store holds the file
   * it declared, and lands it with `land`. An upload that fails goes back to pending, so its
   * commit can be tried again.
   */
  async function finalizeUpload<T>(
    upload: UploadRow,
    multipart: CommitUploadInput['multipart'],
    land: (stored: StoredObject) => Promise<T>
  ): Promise<T> {
    if (upload.status !== 'pending' || new Date(upload.expiresAt).getTime() <= Date.now()) {
      throw new UploadInvalidError()
    }
    const claimed = await database
      .updateTable('upload')
      .set({ status: 'finalizing', finalizationStartedAt: new Date() })
      .where('id', '=', upload.id)
      .where('status', '=', 'pending')
      .returning('id')
      .executeTakeFirst()
    if (!claimed) throw new UploadInvalidError()
    try {
      if (multipart) {
        if (
          !objects.capabilities.multipartUpload ||
          multipart.uploadId !== upload.multipartUploadId
        ) {
          throw new UploadInvalidError()
        }
        await objects.completeUpload({
          key: upload.objectKey,
          uploadId: multipart.uploadId,
          parts: multipart.parts
        })
      }
      const stored = await objects.head(upload.objectKey)
      if (!stored || !matchesUpload(stored, upload)) throw new UploadInvalidError()
      return await land(stored)
    } catch (error) {
      await database
        .updateTable('upload')
        .set({ status: 'pending', finalizationStartedAt: null })
        .where('id', '=', upload.id)
        .where('status', '=', 'finalizing')
        .execute()
      throw error
    }
  }

  function landImage(upload: UploadRow, stored: StoredObject): Promise<void> {
    return database.transaction().execute((transaction) =>
      images.landInTransaction(transaction, {
        uploadId: upload.id,
        workspaceId: upload.workspaceId,
        objectKey: upload.objectKey,
        stored
      })
    )
  }

  async function commitUpload(
    userId: string,
    uploadId: string,
    input: CommitUploadInput
  ): Promise<DocumentSummary> {
    const upload = await selectUploads()
      .where('upload.id', '=', uploadId)
      .where('upload.createdBy', '=', userId)
      .executeTakeFirst()
    if (!upload) throw new DocumentNotFoundError()
    const access = await resolveDocumentAccess(database, userId, upload.documentId)
    if (!access) throw new DocumentNotFoundError()
    if (!canEditDocument(access)) throw new DocumentForbiddenError()
    if (input.checksum !== upload.checksum) throw new UploadInvalidError()
    if (upload.status !== 'committed') {
      const checkpointed =
        upload.kind === 'image'
          ? await finalizeUpload(upload, input.multipart, (stored) =>
              landImage(upload, stored).then(() => false)
            )
          : await finalizeUpload(upload, input.multipart, (stored) =>
              database.transaction().execute((transaction) =>
                landRevision(transaction, {
                  userId,
                  uploadId,
                  upload,
                  stored,
                  revisionId: crypto.randomUUID(),
                  storageObjectId: crypto.randomUUID(),
                  images: input.images,
                  name: input.name,
                  kind: input.kind
                })
              )
            )
      if (checkpointed) announceVersions(options.onVersionsChanged, upload.documentId)
    }
    const document = await findDocument(database, userId, upload.documentId)
    if (!document) throw new DocumentNotFoundError()
    return document
  }

  return {
    async cleanupExpiredUploads(now = new Date()): Promise<number> {
      const result = await cleanup.cleanupExpiredUploads({
        batchSize: 100,
        leaseDurationMs: 5 * 60 * 1000,
        now
      })
      if (result.failed > 0) throw new Error('One or more expired uploads could not be cleaned')
      return result.cleaned
    },

    list(userId: string, workspaceId: string): Promise<DocumentSummary[] | undefined> {
      return listDocuments(database, userId, workspaceId)
    },

    listShared(userId: string): Promise<SharedDocument[]> {
      return listSharedDocuments(database, userId)
    },

    async usage(userId: string, workspaceId: string) {
      const role = await workspaceRole(database, userId, workspaceId)
      if (!role) throw new DocumentNotFoundError()
      const result = await database
        .selectFrom('document')
        .leftJoin('documentRevision', 'documentRevision.id', 'document.currentRevisionId')
        .leftJoin('storageObject', 'storageObject.id', 'documentRevision.storageObjectId')
        .select((expression) => [
          expression.fn.count('document.id').as('documentCount'),
          expression.fn.count('storageObject.id').as('objectCount'),
          expression.fn
            .coalesce(expression.fn.sum('storageObject.byteSize'), expression.val(0))
            .as('bytesUsed')
        ])
        .where('document.workspaceId', '=', workspaceId)
        .where('document.deletedAt', 'is', null)
        .executeTakeFirstOrThrow()
      const shared = await currentImageUsage(database, workspaceId)
      return {
        bytesUsed: Number(result.bytesUsed) + shared.bytesUsed,
        objectCount: Number(result.objectCount) + shared.objectCount,
        documentCount: Number(result.documentCount)
      }
    },

    async access(userId: string, documentId: string) {
      const access = await resolveDocumentAccess(database, userId, documentId)
      if (!access) throw new DocumentNotFoundError()
      return access
    },

    async downloadShared(documentId: string): Promise<DocumentDownload> {
      return createDownload(documentId)
    },

    /** Links for images a live room names, for someone who may view the document. */
    async imageLinks(userId: string, documentId: string, checksums: string[]) {
      const access = await resolveDocumentAccess(database, userId, documentId)
      if (!access) throw new DocumentNotFoundError()
      return imageLinksOf(documentId, checksums)
    },

    /** Links for images a live room names, for a guest a share already let in. */
    imageLinksShared(documentId: string, checksums: string[]) {
      return imageLinksOf(documentId, checksums)
    },

    async download(userId: string, documentId: string): Promise<DocumentDownload> {
      const access = await resolveDocumentAccess(database, userId, documentId)
      if (!access) throw new DocumentNotFoundError()
      return createDownload(documentId)
    },

    async remove(userId: string, documentId: string): Promise<void> {
      const access = await resolveDocumentAccess(database, userId, documentId)
      if (!access) throw new DocumentNotFoundError()
      if (!canEditDocument(access) || !(await canDeleteDocument(database, userId, documentId))) {
        throw new DocumentForbiddenError()
      }
      await database
        .updateTable('document')
        .set({ deletedAt: new Date() })
        .where('id', '=', documentId)
        .where('deletedAt', 'is', null)
        .execute()
    },

    async create(
      userId: string,
      workspaceId: string,
      input: CreateDocumentInput
    ): Promise<DocumentSummary> {
      const role = await workspaceRole(database, userId, workspaceId)
      if (!role) throw new DocumentNotFoundError()
      if (!WRITABLE_ROLES.has(role)) throw new DocumentForbiddenError()
      const documentId = input.id ?? crypto.randomUUID()
      await insertDocument(database, {
        id: documentId,
        workspaceId,
        name: input.name,
        kind: input.kind,
        createdBy: userId
      })
      const document = await findDocument(database, userId, documentId)
      if (!document) throw new DocumentNotFoundError()
      return document
    },

    async createUpload(
      userId: string,
      documentId: string,
      input: CreateUploadInput
    ): Promise<CreateDocumentUploadResult> {
      const { document, maximumFileBytes, maximumStorageBytes } = await writableDocument(
        database,
        options,
        userId,
        documentId
      )
      if (document.currentRevisionId !== input.baseRevisionId) throw new DocumentConflictError()
      if (input.byteSize > maximumFileBytes) throw new UploadInvalidError()
      const uploadId = crypto.randomUUID()
      const objectKey = `documents/${document.workspaceId}/${documentId}/uploads/${uploadId}.fig`
      const expiresAt = new Date(Date.now() + UPLOAD_LIFETIME_MS)
      await database.transaction().execute(async (transaction) => {
        await transaction
          .insertInto('upload')
          .values({
            id: uploadId,
            documentId,
            baseRevisionId: input.baseRevisionId,
            objectKey,
            checksum: input.checksum,
            byteSize: input.byteSize,
            contentType: input.contentType,
            multipartUploadId: null,
            status: 'pending',
            finalizationStartedAt: null,
            createdBy: userId,
            expiresAt
          })
          .execute()
        await quota.reserveInTransaction(transaction, {
          workspaceId: document.workspaceId,
          uploadId,
          bytes: input.byteSize,
          expiresAt,
          maximumBytes: maximumStorageBytes
        })
      })
      let objectUpload
      try {
        objectUpload = await objects.createUpload({
          key: objectKey,
          byteSize: input.byteSize,
          checksum: input.checksum,
          contentType: input.contentType,
          expiresAt
        })
      } catch (error) {
        await quota.release(uploadId)
        await database
          .updateTable('upload')
          .set({ status: 'abandoned' })
          .where('id', '=', uploadId)
          .execute()
        throw error
      }
      if (objectUpload.kind === 'multipart') {
        await database
          .updateTable('upload')
          .set({ multipartUploadId: objectUpload.uploadId })
          .where('id', '=', uploadId)
          .execute()
      }
      return { id: uploadId, upload: objectUpload }
    },

    /** Uploads for the images a save of the document will name that its workspace lacks. */
    async requestImageUploads(
      userId: string,
      documentId: string,
      input: RequestImageUploadsInput
    ): Promise<{ uploads: ImageUploadOffer[] }> {
      const { document, maximumFileBytes, maximumStorageBytes } = await writableDocument(
        database,
        options,
        userId,
        documentId
      )
      if (input.images.some((image) => image.byteSize > maximumFileBytes)) {
        throw new UploadInvalidError()
      }
      return {
        uploads: await images.requestUploads({
          userId,
          documentId,
          workspaceId: document.workspaceId,
          images: input.images,
          expiresAt: new Date(Date.now() + UPLOAD_LIFETIME_MS),
          maximumBytes: maximumStorageBytes
        })
      }
    },
    commitUpload,

    /**
     * Commits the image uploads a save asked for in one request, however many there are: each
     * must be an image upload this person made for the document.
     */
    async commitImageUploads(
      userId: string,
      documentId: string,
      uploads: CommitImageUploadsInput['uploads']
    ): Promise<void> {
      const access = await resolveDocumentAccess(database, userId, documentId)
      if (!access) throw new DocumentNotFoundError()
      if (!canEditDocument(access)) throw new DocumentForbiddenError()
      const ids = uniq(uploads.map((upload) => upload.uploadId))
      const rows = new Map(
        (
          await selectUploads()
            .where('upload.id', 'in', ids)
            .where('upload.documentId', '=', documentId)
            .where('upload.createdBy', '=', userId)
            .execute()
        ).map((row) => [row.id, row])
      )
      if (rows.size !== ids.length || [...rows.values()].some((row) => row.kind !== 'image')) {
        throw new UploadInvalidError()
      }
      for (const commit of uploads) {
        if (rows.get(commit.uploadId)?.checksum !== commit.checksum) throw new UploadInvalidError()
      }
      // Each image is its own object, so a few are checked and landed at once, each once however
      // often the request names it.
      const land = limitAsync(
        (upload: UploadRow, multipart: CommitUploadInput['multipart']) =>
          finalizeUpload(upload, multipart, (stored) => landImage(upload, stored)),
        IMAGE_COMMIT_CONCURRENCY
      )
      await Promise.all(
        uniqBy(uploads, (commit) => commit.uploadId).map(async (commit) => {
          const upload = rows.get(commit.uploadId)
          if (!upload) throw new UploadInvalidError()
          if (upload.status !== 'committed') await land(upload, commit.multipart)
        })
      )
    }
  }
}

export type DocumentService = ReturnType<typeof createDocumentService>
