import type {
  CreateDocumentInput,
  DocumentDownload,
  DocumentSummary,
  SharedDocument
} from '#cloud/contract'
import { workspaceRoleCan } from '#cloud/server/auth/access-control'
import { createUploadCleanupService } from '#cloud/server/cleanup'
import type { CloudDatabase } from '#cloud/server/db'
import {
  canDeleteDocument,
  canEditDocument,
  resolveDocumentAccess
} from '#cloud/server/documents/access'
import { DocumentForbiddenError, DocumentNotFoundError } from '#cloud/server/documents/errors'
import {
  createDocumentImages,
  currentImageUsage,
  documentImageLinks,
  revisionImageDownloads
} from '#cloud/server/documents/images'
import {
  findDocument,
  insertDocument,
  listDocuments,
  listSharedDocuments,
  workspaceRole
} from '#cloud/server/documents/repository'
import { documentSummary, getDocumentSummaryRow } from '#cloud/server/documents/summary'
import {
  createDocumentTrash,
  DEFAULT_TRASH_OPTIONS,
  type DocumentTrashOptions
} from '#cloud/server/documents/trash'
import { createDocumentUploads } from '#cloud/server/documents/uploads'
import type { CloudErrorReporter } from '#cloud/server/errors'
import type { ObjectStore } from '#cloud/server/objects'
import type { CloudPolicy } from '#cloud/server/policy/policy'
import { storageLimitReached } from '#cloud/server/policy/storage'
import { createStorageQuotaService, StorageQuotaExceededError } from '#cloud/server/quota'
import type { Kysely } from 'kysely'

const DOWNLOAD_LIFETIME_MS = 5 * 60 * 1000

export type DocumentServiceOptions = {
  policy?: CloudPolicy
  technicalMaximumUploadBytes?: number
  /** Called once a save adds a checkpoint to the document's history. */
  onVersionsChanged?: (documentId: string) => void
  /** How long Trash keeps documents, the grace of one deleted forever, and the cleanup lease. */
  trash?: DocumentTrashOptions
  /** Where cleanup the service runs itself, such as of expired uploads, reports a failure. */
  reportError?: CloudErrorReporter
}

export function createDocumentService(
  database: Kysely<CloudDatabase>,
  objects: ObjectStore,
  options: DocumentServiceOptions = {}
) {
  const cleanup = createUploadCleanupService(database, objects, options.reportError)
  const quota = createStorageQuotaService(database)
  const images = createDocumentImages(database, objects, quota)
  const trash = createDocumentTrash(database, objects, options.trash ?? DEFAULT_TRASH_OPTIONS)
  const uploads = createDocumentUploads(database, objects, { quota, images, options })
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

    /** Trash: list what the person may restore, restore it, or delete it for good. */
    trash,

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
        .set({ deletedAt: new Date(), deletedBy: userId })
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
      if (!workspaceRoleCan(role, { document: ['create'] })) throw new DocumentForbiddenError()
      if (await storageLimitReached(database, options.policy, { workspaceId })) {
        throw new StorageQuotaExceededError('The owner holds their whole storage allowance')
      }
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
    /** Saving: uploads of revisions and their images, and committing them. */
    ...uploads
  }
}

export type DocumentService = ReturnType<typeof createDocumentService>
