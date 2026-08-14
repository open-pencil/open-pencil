import type {
  CommitUploadInput,
  CreateDocumentInput,
  CreateUploadInput,
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
    list(userId: string, workspaceId: string): Promise<DocumentSummary[] | undefined> {
      return listDocuments(database, userId, workspaceId)
    },

    async create(
      userId: string,
      workspaceId: string,
      input: CreateDocumentInput
    ): Promise<DocumentSummary> {
      const role = await workspaceRole(database, userId, workspaceId)
      if (!role) throw new DocumentNotFoundError()
      if (!WRITABLE_ROLES.has(role)) throw new DocumentForbiddenError()
      const documentId = crypto.randomUUID()
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
