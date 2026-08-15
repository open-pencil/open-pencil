import type { CloudDatabase } from '#cloud/server/db'
import type { ObjectStore } from '#cloud/server/objects'
import type { Kysely } from 'kysely'

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
}

type ClaimedDocument = {
  id: string
  deletedAt: Date
}

type StoredRevisionObject = {
  id: string
  objectKey: string
  byteSize: number
}

export function createDocumentCleanupService(
  database: Kysely<CloudDatabase>,
  objects: ObjectStore
): DocumentCleanupService {
  return {
    async cleanupDeletedDocuments(options) {
      const now = options.now ?? new Date()
      const retentionBefore = new Date(now.getTime() - options.retentionMs)
      const staleBefore = new Date(now.getTime() - options.leaseDurationMs)
      const claimId = crypto.randomUUID()
      const documents = await claimDocuments(
        database,
        options.batchSize,
        retentionBefore,
        staleBefore,
        now,
        claimId
      )
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
            retentionBefore,
            claimId
          )
          if (!reclaimed) continue
          result.cleaned++
          result.objectsDeleted += reclaimed.objectsDeleted
          result.bytesReclaimed += reclaimed.bytesReclaimed
        } catch {
          result.failed++
          await releaseClaim(database, document.id, claimId)
        }
      }
      return result
    }
  }
}

async function claimDocuments(
  database: Kysely<CloudDatabase>,
  batchSize: number,
  retentionBefore: Date,
  staleBefore: Date,
  now: Date,
  claimId: string
): Promise<ClaimedDocument[]> {
  return database.transaction().execute(async (transaction) => {
    const candidates = await transaction
      .selectFrom('document')
      .select(['id', 'deletedAt'])
      .where('deletedAt', 'is not', null)
      .where('deletedAt', '<=', retentionBefore)
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
    const claimed = candidates.filter(
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
  retentionBefore: Date,
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
      locked.deletedAt > retentionBefore ||
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
        .where((expression) =>
          expression.not(
            expression.exists(
              expression
                .selectFrom('documentRevision')
                .select('documentRevision.id')
                .whereRef('documentRevision.storageObjectId', '=', 'storageObject.id')
            )
          )
        )
        .executeTakeFirst()
      if (Number(deleted.numDeletedRows) > 0) {
        objectsDeleted++
        bytesReclaimed += object.byteSize
      }
    }
    await transaction.deleteFrom('document').where('id', '=', document.id).execute()
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
