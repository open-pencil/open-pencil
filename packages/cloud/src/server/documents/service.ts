import type {
  CommitUploadInput,
  CreateDocumentInput,
  CreateUploadInput,
  DocumentDownload,
  DocumentSummary
} from '#cloud/contract'
import { createUploadCleanupService } from '#cloud/server/cleanup'
import type { CloudDatabase } from '#cloud/server/db'
import { canEditDocument, resolveDocumentAccess } from '#cloud/server/documents/access'
import {
  findDocument,
  insertDocument,
  listDocuments,
  workspaceRole
} from '#cloud/server/documents/repository'
import { documentSummary, getDocumentSummaryRow } from '#cloud/server/documents/summary'
import type { CreateDocumentUploadResult } from '#cloud/server/documents/types'
import type { ObjectStore } from '#cloud/server/objects'
import { CLOUD_FEATURE_KEYS } from '#cloud/server/policy/keys'
import type { CloudPolicy } from '#cloud/server/policy/policy'
import { createStorageQuotaService } from '#cloud/server/quota'
import type { Kysely } from 'kysely'

const DOWNLOAD_LIFETIME_MS = 5 * 60 * 1000
const UPLOAD_LIFETIME_MS = 15 * 60 * 1000
const WRITABLE_ROLES = new Set(['admin', 'editor'])

export class DocumentNotFoundError extends Error {
  override readonly name = 'DocumentNotFoundError'
}
export class DocumentForbiddenError extends Error {
  override readonly name = 'DocumentForbiddenError'
}
export class DocumentConflictError extends Error {
  override readonly name = 'DocumentConflictError'
}
export class UploadInvalidError extends Error {
  override readonly name = 'UploadInvalidError'
}

export type DocumentServiceOptions = {
  policy?: CloudPolicy
  technicalMaximumUploadBytes?: number
}

export function createDocumentService(
  database: Kysely<CloudDatabase>,
  objects: ObjectStore,
  options: DocumentServiceOptions = {}
) {
  const cleanup = createUploadCleanupService(database, objects)
  const quota = createStorageQuotaService(database)

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
    return {
      document,
      revisionId: revision.revisionId,
      byteSize: Number(revision.byteSize),
      checksum: revision.checksum,
      contentType: revision.contentType,
      download: await objects.createDownload({
        key: revision.objectKey,
        expiresAt: new Date(Date.now() + DOWNLOAD_LIFETIME_MS)
      })
    }
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
      return {
        bytesUsed: Number(result.bytesUsed),
        objectCount: Number(result.objectCount),
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

    async download(userId: string, documentId: string): Promise<DocumentDownload> {
      const access = await resolveDocumentAccess(database, userId, documentId)
      if (!access) throw new DocumentNotFoundError()
      return createDownload(documentId)
    },

    async remove(userId: string, documentId: string): Promise<void> {
      const access = await resolveDocumentAccess(database, userId, documentId)
      if (!access) throw new DocumentNotFoundError()
      if (!canEditDocument(access)) throw new DocumentForbiddenError()
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
      const access = await resolveDocumentAccess(database, userId, documentId)
      if (!access) throw new DocumentNotFoundError()
      if (!canEditDocument(access)) throw new DocumentForbiddenError()
      const document = await findDocument(database, userId, documentId)
      if (!document) throw new DocumentNotFoundError()
      if (document.currentRevisionId !== input.baseRevisionId) throw new DocumentConflictError()
      const policyContext = {
        targetingKey: document.workspaceId,
        actorId: userId,
        workspaceId: document.workspaceId,
        documentId,
        deploymentMode: 'self-hosted' as const
      }
      const technicalMaximum = options.technicalMaximumUploadBytes ?? Number.MAX_SAFE_INTEGER
      const entitlementMaximum = options.policy
        ? await options.policy.number(
            CLOUD_FEATURE_KEYS.maximumFileBytes,
            technicalMaximum,
            policyContext
          )
        : technicalMaximum
      if (input.byteSize > Math.min(technicalMaximum, entitlementMaximum)) {
        throw new UploadInvalidError()
      }
      const maximumStorageBytes = options.policy
        ? await options.policy.number(
            'cloud.storage.maximum-bytes',
            Number.MAX_SAFE_INTEGER,
            policyContext
          )
        : Number.MAX_SAFE_INTEGER
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
            createdBy: userId,
            expiresAt
          })
          .execute()
        await quota.reserveInTransaction(transaction, {
          workspaceId: document.workspaceId,
          uploadId,
          bytes: input.byteSize,
          expiresAt,
          maximumBytes: maximumStorageBytes === Number.MAX_SAFE_INTEGER ? null : maximumStorageBytes
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

    async commitUpload(
      userId: string,
      uploadId: string,
      input: CommitUploadInput
    ): Promise<DocumentSummary> {
      const upload = await database
        .selectFrom('upload')
        .innerJoin('document', 'document.id', 'upload.documentId')
        .select([
          'upload.documentId',
          'upload.baseRevisionId',
          'upload.objectKey',
          'upload.checksum',
          'upload.byteSize',
          'upload.contentType',
          'upload.multipartUploadId',
          'upload.status',
          'upload.expiresAt'
        ])
        .where('upload.id', '=', uploadId)
        .where('upload.createdBy', '=', userId)
        .executeTakeFirst()
      if (!upload) throw new DocumentNotFoundError()
      const access = await resolveDocumentAccess(database, userId, upload.documentId)
      if (!access) throw new DocumentNotFoundError()
      if (!canEditDocument(access)) throw new DocumentForbiddenError()
      if (input.checksum !== upload.checksum) throw new UploadInvalidError()
      if (upload.status === 'committed') {
        const document = await findDocument(database, userId, upload.documentId)
        if (!document) throw new DocumentNotFoundError()
        return document
      }
      if (upload.status !== 'pending' || new Date(upload.expiresAt).getTime() <= Date.now()) {
        throw new UploadInvalidError()
      }
      const claimed = await database
        .updateTable('upload')
        .set({ status: 'finalizing' })
        .where('id', '=', uploadId)
        .where('status', '=', 'pending')
        .returning('id')
        .executeTakeFirst()
      if (!claimed) throw new UploadInvalidError()
      try {
        if (input.multipart) {
          if (
            !objects.capabilities.multipartUpload ||
            input.multipart.uploadId !== upload.multipartUploadId
          ) {
            throw new UploadInvalidError()
          }
          await objects.completeUpload({
            key: upload.objectKey,
            uploadId: input.multipart.uploadId,
            parts: input.multipart.parts
          })
        }
        const stored = await objects.head(upload.objectKey)
        if (
          !stored ||
          stored.checksum !== input.checksum ||
          stored.checksum !== upload.checksum ||
          stored.byteSize !== Number(upload.byteSize) ||
          stored.contentType !== upload.contentType
        ) {
          throw new UploadInvalidError()
        }

        const revisionId = crypto.randomUUID()
        const storageObjectId = crypto.randomUUID()
        await database.transaction().execute(async (transaction) => {
          const lockedUpload = await transaction
            .selectFrom('upload')
            .select('status')
            .where('id', '=', uploadId)
            .forUpdate()
            .executeTakeFirstOrThrow()
          if (lockedUpload.status === 'committed') return
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
          await transaction
            .updateTable('document')
            .set({
              currentRevisionId: revisionId,
              version: (expression) => expression('version', '+', 1)
            })
            .where('id', '=', upload.documentId)
            .execute()
          await transaction
            .updateTable('upload')
            .set({ status: 'committed' })
            .where('id', '=', uploadId)
            .execute()
          await quota.commitInTransaction(transaction, uploadId)
        })
      } catch (error) {
        await database
          .updateTable('upload')
          .set({ status: 'pending' })
          .where('id', '=', uploadId)
          .where('status', '=', 'finalizing')
          .execute()
        throw error
      }
      const document = await findDocument(database, userId, upload.documentId)
      if (!document) throw new DocumentNotFoundError()
      return document
    }
  }
}

export type DocumentService = ReturnType<typeof createDocumentService>
