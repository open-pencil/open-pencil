import type { CloudDatabase } from '#cloud/server/db'
import { reportCloudError, type CloudErrorReporter } from '#cloud/server/errors'
import type { ObjectStore } from '#cloud/server/objects'
import { omit } from 'es-toolkit'
import type { ExpressionBuilder, Kysely, Transaction } from 'kysely'

import { unreferencedObject } from './objects'

export type DocumentCleanupOptions = {
  batchSize: number
  leaseDurationMs: number
  /** How long a document stays in Trash before cleanup destroys it. */
  retentionMs: number
  /** How long a document deleted forever keeps its files before cleanup destroys it; 0 is at once. */
  purgeGraceMs: number
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
   * Destroys one document deleted forever now, as cleanup would once its grace passed. False when
   * it isn't deleted forever, is being cleaned already, or has a save in flight; it then waits for
   * the next pass. Throws, with the failure as its cause, when destroying it failed; the failure
   * is reported, and the next pass tries again.
   */
  destroyPurgedDocument(
    documentId: string,
    options: { leaseDurationMs: number; now?: Date }
  ): Promise<boolean>
}

export type DocumentCleanupServiceOptions = {
  /** Where each document cleanup couldn't destroy is reported; a pass carries on with the rest. */
  reportError?: CloudErrorReporter
}

type ClaimedDocument = {
  id: string
  workspaceId: string
  purgedBytes: number
}

type StoredRevisionObject = {
  id: string
  objectKey: string
  byteSize: number
}

/**
 * Which deleted documents a pass claims: those in Trash deleted by `deletedBefore`, and those
 * deleted forever by `purgedBefore`, or only one of them.
 */
type ClaimFilter = {
  batchSize: number
  deletedBefore: Date
  purgedBefore: Date
  staleBefore: Date
  now: Date
  claimId: string
  documentId?: string
}

/** A deleted document whose time is up: past retention in Trash, or past grace deleted forever. */
function due(deletedBefore: Date, purgedBefore: Date) {
  return (expression: ExpressionBuilder<CloudDatabase, 'document'>) =>
    expression.or([
      expression.and([
        expression('purgedAt', 'is', null),
        expression('deletedAt', 'is not', null),
        expression('deletedAt', '<=', deletedBefore)
      ]),
      expression('purgedAt', '<=', purgedBefore)
    ])
}

export function createDocumentCleanupService(
  database: Kysely<CloudDatabase>,
  objects: ObjectStore,
  options: DocumentCleanupServiceOptions = {}
): DocumentCleanupService {
  async function clean(
    filter: ClaimFilter
  ): Promise<DocumentCleanupResult & { failures: unknown[] }> {
    const documents = await claimDocuments(database, filter)
    const result = {
      claimed: documents.length,
      cleaned: 0,
      failed: 0,
      objectsDeleted: 0,
      bytesReclaimed: 0,
      failures: [] as unknown[]
    }
    for (const document of documents) {
      try {
        const revisionObjects = await documentObjects(database, document.id)
        for (const object of revisionObjects) await objects.delete(object.objectKey)
        const reclaimed = await removeDocumentMetadata(database, document, revisionObjects, filter)
        if (!reclaimed) continue
        result.cleaned++
        result.objectsDeleted += reclaimed.objectsDeleted
        result.bytesReclaimed += reclaimed.bytesReclaimed
      } catch (error) {
        result.failed++
        result.failures.push(error)
        // Only the document's ID: its name and the people on it stay out of error tracking.
        await reportCloudError(
          options.reportError,
          `Cleaning up document ${document.id} failed:`,
          error,
          { source: 'cleanup' }
        )
        // Out of Trash already, a document whose files are partly gone is never restorable; the
        // next pass tries again.
        await releaseClaim(database, document.id, filter.claimId)
      }
    }
    return result
  }

  return {
    async cleanupDeletedDocuments(input) {
      const now = input.now ?? new Date()
      const result = await clean({
        batchSize: input.batchSize,
        deletedBefore: new Date(now.getTime() - input.retentionMs),
        purgedBefore: new Date(now.getTime() - input.purgeGraceMs),
        staleBefore: new Date(now.getTime() - input.leaseDurationMs),
        now,
        claimId: crypto.randomUUID()
      })
      return omit(result, ['failures'])
    },

    async destroyPurgedDocument(documentId, input) {
      const now = input.now ?? new Date()
      const result = await clean({
        batchSize: 1,
        // Only a document deleted forever, never one still in Trash.
        deletedBefore: new Date(0),
        purgedBefore: now,
        staleBefore: new Date(now.getTime() - input.leaseDurationMs),
        now,
        claimId: crypto.randomUUID(),
        documentId
      })
      if (result.failures.length > 0) {
        throw new Error(`Document ${documentId} could not be destroyed`, {
          cause: result.failures[0]
        })
      }
      return result.cleaned > 0
    }
  }
}

async function claimDocuments(
  database: Kysely<CloudDatabase>,
  { batchSize, deletedBefore, purgedBefore, staleBefore, now, claimId, documentId }: ClaimFilter
): Promise<ClaimedDocument[]> {
  return database.transaction().execute(async (transaction) => {
    let candidates = transaction
      .selectFrom('document')
      .select(['id', 'workspaceId', 'purgedBytes'])
      .where(due(deletedBefore, purgedBefore))
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
    if (rows.length === 0) return []
    await transaction
      .updateTable('document')
      .set({ cleanupClaimId: claimId, cleanupClaimedAt: now })
      .where(
        'id',
        'in',
        rows.map((document) => document.id)
      )
      .execute()
    return rows.map((row) => ({ ...row, purgedBytes: Number(row.purgedBytes) }))
  })
}

/** The files only this document's revisions hold, which destroying it frees. */
export async function documentObjects(
  database: Kysely<CloudDatabase> | Transaction<CloudDatabase>,
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
  { deletedBefore, purgedBefore, claimId }: ClaimFilter
): Promise<{ objectsDeleted: number; bytesReclaimed: number } | null> {
  return database.transaction().execute(async (transaction) => {
    const locked = await transaction
      .selectFrom('document')
      .select('id')
      .where('id', '=', document.id)
      .where(due(deletedBefore, purgedBefore))
      .where('cleanupClaimId', '=', claimId)
      .forUpdate()
      .executeTakeFirst()
    if (!locked) return null
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
    // Deleting it forever already took its files off the workspace's usage.
    const released = Math.max(0, bytesReclaimed - document.purgedBytes)
    if (released > 0) {
      await transaction
        .updateTable('workspaceStorageUsage')
        .set({
          committedBytes: (expression) => expression('committedBytes', '-', released),
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
