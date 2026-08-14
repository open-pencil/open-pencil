import type {
  CommitUploadInput,
  CreateDocumentInput,
  CreateUploadInput,
  DocumentDownload,
  DocumentSummary
} from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import {
  findDocument,
  insertDocument,
  listDocuments,
  workspaceRole
} from '#cloud/server/documents/repository'
import type { ObjectStore, ObjectUpload } from '#cloud/server/objects'
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

export function createDocumentService(database: Kysely<CloudDatabase>, objects: ObjectStore) {
  return {
    async cleanupExpiredUploads(now = new Date()): Promise<number> {
      const uploads = await database
        .selectFrom('upload')
        .select(['id', 'objectKey'])
        .where('status', '=', 'pending')
        .where('expiresAt', '<=', now)
        .execute()
      let cleaned = 0
      for (const upload of uploads) {
        const result = await database
          .updateTable('upload')
          .set({ status: 'abandoned' })
          .where('id', '=', upload.id)
          .where('status', '=', 'pending')
          .where('expiresAt', '<=', now)
          .executeTakeFirst()
        if (Number(result.numUpdatedRows) === 0) continue
        try {
          await objects.delete(upload.objectKey)
        } catch (error) {
          await database
            .updateTable('upload')
            .set({ status: 'pending' })
            .where('id', '=', upload.id)
            .where('status', '=', 'abandoned')
            .execute()
          throw error
        }
        cleaned++
      }
      return cleaned
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

    async download(userId: string, documentId: string): Promise<DocumentDownload> {
      const document = await findDocument(database, userId, documentId)
      if (!document?.currentRevisionId) throw new DocumentNotFoundError()
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
      const download = await objects.createDownload({
        key: revision.objectKey,
        expiresAt: new Date(Date.now() + DOWNLOAD_LIFETIME_MS)
      })
      return {
        document,
        revisionId: revision.revisionId,
        byteSize: Number(revision.byteSize),
        checksum: revision.checksum,
        contentType: revision.contentType,
        download
      }
    },

    async remove(userId: string, documentId: string): Promise<void> {
      const document = await findDocument(database, userId, documentId)
      if (!document) throw new DocumentNotFoundError()
      if (!WRITABLE_ROLES.has(document.role)) throw new DocumentForbiddenError()
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
    ): Promise<{ id: string; upload: ObjectUpload }> {
      const document = await findDocument(database, userId, documentId)
      if (!document) throw new DocumentNotFoundError()
      if (!WRITABLE_ROLES.has(document.role)) throw new DocumentForbiddenError()
      if (document.currentRevisionId !== input.baseRevisionId) throw new DocumentConflictError()
      const uploadId = crypto.randomUUID()
      const objectKey = `documents/${document.workspaceId}/${documentId}/uploads/${uploadId}.fig`
      const expiresAt = new Date(Date.now() + UPLOAD_LIFETIME_MS)
      await database
        .insertInto('upload')
        .values({
          id: uploadId,
          documentId,
          baseRevisionId: input.baseRevisionId,
          objectKey,
          checksum: input.checksum,
          byteSize: input.byteSize,
          contentType: input.contentType,
          status: 'pending',
          createdBy: userId,
          expiresAt
        })
        .execute()
      const upload = await objects.createUpload({
        key: objectKey,
        byteSize: input.byteSize,
        checksum: input.checksum,
        contentType: input.contentType,
        expiresAt
      })
      return { id: uploadId, upload }
    },

    async commitUpload(
      userId: string,
      uploadId: string,
      input: CommitUploadInput
    ): Promise<DocumentSummary> {
      const upload = await database
        .selectFrom('upload')
        .innerJoin('document', 'document.id', 'upload.documentId')
        .innerJoin('workspaceMember', 'workspaceMember.workspaceId', 'document.workspaceId')
        .select([
          'upload.documentId',
          'upload.baseRevisionId',
          'upload.objectKey',
          'upload.checksum',
          'upload.byteSize',
          'upload.contentType',
          'upload.status',
          'upload.expiresAt',
          'workspaceMember.role'
        ])
        .where('upload.id', '=', uploadId)
        .where('workspaceMember.userId', '=', userId)
        .executeTakeFirst()
      if (!upload) throw new DocumentNotFoundError()
      if (!WRITABLE_ROLES.has(upload.role)) throw new DocumentForbiddenError()
      if (input.checksum !== upload.checksum) throw new UploadInvalidError()
      if (upload.status === 'committed') {
        const document = await findDocument(database, userId, upload.documentId)
        if (!document) throw new DocumentNotFoundError()
        return document
      }
      if (upload.status !== 'pending' || new Date(upload.expiresAt).getTime() <= Date.now()) {
        throw new UploadInvalidError()
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
        if (lockedUpload.status !== 'pending') throw new UploadInvalidError()
        const document = await transaction
          .selectFrom('document')
          .select(['currentRevisionId'])
          .where('id', '=', upload.documentId)
          .forUpdate()
          .executeTakeFirstOrThrow()
        if (document.currentRevisionId !== upload.baseRevisionId) throw new DocumentConflictError()
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
      })
      const document = await findDocument(database, userId, upload.documentId)
      if (!document) throw new DocumentNotFoundError()
      return document
    }
  }
}

export type DocumentService = ReturnType<typeof createDocumentService>
