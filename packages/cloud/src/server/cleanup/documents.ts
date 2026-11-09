import type { CloudDatabase } from '#cloud/server/db'
import type { ObjectStore } from '#cloud/server/objects'
import type { Kysely } from 'kysely'

import { unreferencedObject } from './objects'

export type DocumentCleanupOptions = {
  batchSize: number
  leaseDurationMs: number
  retentionMs: number
  now?: Date
}

export type DocumentCleanupResult = {
  claimed: number
  cleaned: number
  failed: number
  objectsDeleted: number
  bytesReclaimed: number
}

export type DocumentCleanupService = {
  cleanupDeletedDocuments(options: DocumentCleanupOptions): Promise<DocumentCleanupResult>
  /**
   * Deletes one document in Trash for good now, as the cleanup worker would once its retention
   * passed. False when it is not in Trash, is being cleaned already, or has a save in flight.
   */
  purgeDeletedDocument(
    documentId: string,
    options: Pick<DocumentCleanupOptions, 'leaseDurationMs' | 'now'>
  ): Promise<boolean>
}

type ClaimedDocument = {
  id: string
  workspaceId: string
  deletedAt: Date
}

type StoredRevisionObject = {
  id: string
  objectKey: string
  byteSize: number
}

/** Which deleted documents a pass claims: those deleted by `deletedBefore`, or only one. */
type ClaimFilter = {
  batchSize: number
  deletedBefore: Date
  staleBefore: Date
  now: Date
  claimId: string
  documentId?: string
}

export function createDocumentCleanupService(
  database: Kysely<CloudDatabase>,
  objects: ObjectStore
): DocumentCleanupService {
  async function clean(filter: ClaimFilter): Promise<DocumentCleanupResult> {
    const documents = await claimDocuments(database, filter)
    const result: DocumentCleanupResult = {
      claimed: documents.length,
      cleaned: 0,
      failed: 0,
      objectsDeleted: 0,
      bytesReclaimed: 0
    }
    for (const document of documents) {
      try {
        const revisionObjects = await documentObjects(database, document.id)
        for (const object of revisionObjects) await objects.delete(object.objectKey)
        const reclaimed = await removeDocumentMetadata(
          database,
          document,
          revisionObjects,
          filter.deletedBefore,
          filter.claimId
        )
        if (!reclaimed) continue
        result.cleaned++
        result.objectsDeleted += reclaimed.objectsDeleted
        result.bytesReclaimed += reclaimed.bytesReclaimed
      } catch {
        result.failed++
        await releaseClaim(database, document.id, filter.claimId)
      }
    }
    return result
  }

  return {
    cleanupDeletedDocuments(options) {
      const now = options.now ?? new Date()
      return clean({
        batchSize: options.batchSize,
        deletedBefore: new Date(now.getTime() - options.retentionMs),
        staleBefore: new Date(now.getTime() - options.leaseDurationMs),
        now,
        claimId: crypto.randomUUID()
      })
    },

    async purgeDeletedDocument(documentId, options) {
      const now = options.now ?? new Date()
      const result = await clean({
        batchSize: 1,
        deletedBefore: now,
        staleBefore: new Date(now.getTime() - options.leaseDurationMs),
        now,
        claimId: crypto.randomUUID(),
        documentId
      })
      if (result.failed > 0) throw new Error('The document could not be deleted for good')
      return result.cleaned > 0
    }
  }
}

async function claimDocuments(
  database: Kysely<CloudDatabase>,
  { batchSize, deletedBefore, staleBefore, now, claimId, documentId }: ClaimFilter
): Promise<ClaimedDocument[]> {
  return database.transaction().execute(async (transaction) => {
    let candidates = transaction
      .selectFrom('document')
      .select(['id', 'workspaceId', 'deletedAt'])
      .where('deletedAt', 'is not', null)
      .where('deletedAt', '<=', deletedBefore)
    if (documentId !== undefined) candidates = candidates.where('id', '=', documentId)
    const rows = await candidates
      .where((expression) =>
        expression.or([
          expression('cleanupClaimId', 'is', null),
          expression('cleanupClaimedAt', '<=', staleBefore)
        ])
      )
      .where((expression) =>
        expression.not(
          expression.exists(
            expression
              .selectFrom('upload')
              .select('upload.id')
              .whereRef('upload.documentId', '=', 'document.id')
              .where('upload.status', 'in', ['pending', 'cleaning'])
          )
        )
      )
      .orderBy('deletedAt')
      .limit(batchSize)
      .forUpdate()
      .skipLocked()
      .execute()
    const claimed = rows.filter(
      (document): document is ClaimedDocument => document.deletedAt !== null
    )
    if (claimed.length === 0) return []
    await transaction
      .updateTable('document')
      .set({ cleanupClaimId: claimId, cleanupClaimedAt: now })
      .where(
        'id',
        'in',
        claimed.map((document) => document.id)
      )
      .execute()
    return claimed
  })
}

async function documentObjects(
  database: Kysely<CloudDatabase>,
  documentId: string
): Promise<StoredRevisionObject[]> {
  const rows = await database
    .selectFrom('documentRevision')
    .innerJoin('storageObject', 'storageObject.id', 'documentRevision.storageObjectId')
    .select(['storageObject.id', 'storageObject.objectKey', 'storageObject.byteSize'])
    .where('documentRevision.documentId', '=', documentId)
    .where((expression) =>
      expression.not(
        expression.exists(
          expression
            .selectFrom('documentRevision as otherRevision')
            .select('otherRevision.id')
            .whereRef('otherRevision.storageObjectId', '=', 'storageObject.id')
            .where('otherRevision.documentId', '!=', documentId)
        )
      )
    )
    .execute()
  return rows.map((row) => ({ ...row, byteSize: Number(row.byteSize) }))
}

async function removeDocumentMetadata(
  database: Kysely<CloudDatabase>,
  document: ClaimedDocument,
  objects: StoredRevisionObject[],
  deletedBefore: Date,
  claimId: string
): Promise<{ objectsDeleted: number; bytesReclaimed: number } | null> {
  return database.transaction().execute(async (transaction) => {
    const locked = await transaction
      .selectFrom('document')
      .select(['deletedAt', 'cleanupClaimId'])
      .where('id', '=', document.id)
      .forUpdate()
      .executeTakeFirst()
    if (
      !locked?.deletedAt ||
      locked.deletedAt > deletedBefore ||
      locked.cleanupClaimId !== claimId
    ) {
      return null
    }
    await transaction
      .updateTable('document')
      .set({ currentRevisionId: null })
      .where('id', '=', document.id)
      .execute()
    await transaction.deleteFrom('documentRevision').where('documentId', '=', document.id).execute()
    let objectsDeleted = 0
    let bytesReclaimed = 0
    for (const object of objects) {
      const deleted = await transaction
        .deleteFrom('storageObject')
        .where('id', '=', object.id)
        .where(unreferencedObject)
        .executeTakeFirst()
      if (Number(deleted.numDeletedRows) > 0) {
        objectsDeleted++
        bytesReclaimed += object.byteSize
      }
    }
    if (bytesReclaimed > 0) {
      await transaction
        .updateTable('workspaceStorageUsage')
        .set({
          committedBytes: (expression) => expression('committedBytes', '-', bytesReclaimed),
          updatedAt: new Date()
        })
        .where('workspaceId', '=', document.workspaceId)
        .execute()
    }
    await transaction.deleteFrom('document').where('id', '=', document.id).execute()
    // A workspace whose account was deleted waits, with nobody in it, for its last document.
    await transaction
      .deleteFrom('workspace')
      .where('id', '=', document.workspaceId)
      .where((expression) =>
        expression.and([
          expression.not(
            expression.exists(
              expression
                .selectFrom('workspaceMember')
                .select('workspaceMember.userId')
                .whereRef('workspaceMember.workspaceId', '=', 'workspace.id')
            )
          ),
          expression.not(
            expression.exists(
              expression
                .selectFrom('document')
                .select('document.id')
                .whereRef('document.workspaceId', '=', 'workspace.id')
            )
          )
        ])
      )
      .execute()
    return { objectsDeleted, bytesReclaimed }
  })
}

async function releaseClaim(
  database: Kysely<CloudDatabase>,
  documentId: string,
  claimId: string
): Promise<void> {
  await database
    .updateTable('document')
    .set({ cleanupClaimId: null, cleanupClaimedAt: null })
    .where('id', '=', documentId)
    .where('cleanupClaimId', '=', claimId)
    .execute()
}
