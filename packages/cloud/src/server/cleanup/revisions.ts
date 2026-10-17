import type { CloudDatabase } from '#cloud/server/db'
import { historyStart, LIMITED_HISTORY_DAYS } from '#cloud/server/documents/versions/history'
import type { ObjectStore } from '#cloud/server/objects'
import type { CloudPolicyContext } from '#cloud/server/policy/keys'
import type { CloudPolicy } from '#cloud/server/policy/policy'
import { groupBy, sumBy, uniq } from 'es-toolkit'
import type { Kysely, Transaction } from 'kysely'

import { unreferencedObject } from './objects'

/** How long a save between versions is kept before compaction may delete it. */
export const REVISION_COMPACTION_GRACE_MS = 24 * 60 * 60_000

export type RevisionCompactionOptions = {
  batchSize: number
  /** How long a save stays before it can be compacted, so recent work is never lost to it. */
  graceMs: number
  now?: Date
}

export type RevisionCompactionResult = {
  versionsPruned: number
  revisionsDeleted: number
  objectsDeleted: number
  bytesReclaimed: number
  failed: number
}

export type RevisionCompactionService = {
  compactRevisions(options: RevisionCompactionOptions): Promise<RevisionCompactionResult>
}

/**
 * Keeps a document's stored history to its versions. A save that is neither the document's
 * current state nor kept by a version is deleted once it is older than the grace period, and its
 * file with it when nothing else uses it; a workspace without full history first loses the
 * versions older than its 30 days.
 */
export function createRevisionCompactionService(
  database: Kysely<CloudDatabase>,
  objects: ObjectStore,
  options: { policy?: CloudPolicy; deploymentMode?: CloudPolicyContext['deploymentMode'] } = {}
): RevisionCompactionService {
  const deploymentMode = options.deploymentMode ?? 'self-hosted'
  async function pruneVersions(now: Date, batchSize: number): Promise<number> {
    if (!options.policy) return 0
    const limitedBefore = new Date(now.getTime() - LIMITED_HISTORY_DAYS * 24 * 60 * 60_000)
    const workspaces = await database
      .selectFrom('documentVersion')
      .innerJoin('document', 'document.id', 'documentVersion.documentId')
      .select('document.workspaceId')
      .distinct()
      .where('documentVersion.createdAt', '<', limitedBefore)
      .execute()
    let pruned = 0
    for (const { workspaceId } of workspaces) {
      const start = await historyStart(options.policy, deploymentMode, workspaceId, now)
      if (!start) continue
      const deleted = await database
        .deleteFrom('documentVersion')
        .where('id', 'in', (query) =>
          query
            .selectFrom('documentVersion as version')
            .innerJoin('document', 'document.id', 'version.documentId')
            .select('version.id')
            .where('document.workspaceId', '=', workspaceId)
            .where('version.createdAt', '<', start)
            // The document's current state stays listed however old it is.
            .whereRef('version.revisionId', '!=', 'document.currentRevisionId')
            .limit(batchSize)
        )
        .executeTakeFirst()
      pruned += Number(deleted.numDeletedRows)
    }
    return pruned
  }

  /** Saves that may go: old, unversioned, not current, in a document that is not deleted. */
  function compactable(source: Kysely<CloudDatabase> | Transaction<CloudDatabase>, before: Date) {
    return source
      .selectFrom('documentRevision')
      .innerJoin('document', 'document.id', 'documentRevision.documentId')
      .where('documentRevision.createdAt', '<', before)
      .where('document.deletedAt', 'is', null)
      .where((expression) =>
        expression.or([
          expression('document.currentRevisionId', 'is', null),
          expression('document.currentRevisionId', '!=', expression.ref('documentRevision.id'))
        ])
      )
      .where((expression) =>
        expression.not(
          expression.exists(
            expression
              .selectFrom('documentVersion')
              .select('documentVersion.id')
              .whereRef('documentVersion.revisionId', '=', 'documentRevision.id')
          )
        )
      )
  }

  /** A file no revision refers to: freed by compaction, waiting for the object store. */
  function unreferencedObjects(source: Kysely<CloudDatabase> | Transaction<CloudDatabase>) {
    return source.selectFrom('storageObject').where(unreferencedObject)
  }

  /**
   * Deletes up to `limit` compactable saves of one document and returns the bytes of files nothing
   * refers to any more to the workspace's usage. Their rows stay until the files are gone, so a
   * delete that fails is tried again on the next pass.
   */
  async function compactDocument(
    documentId: string,
    workspaceId: string,
    before: Date,
    limit: number
  ) {
    return database.transaction().execute(async (transaction) => {
      // Saves and restores lock the document too, so none can keep a revision deleted here.
      await transaction
        .selectFrom('document')
        .select('id')
        .where('id', '=', documentId)
        .forUpdate()
        .executeTakeFirst()
      const revisions = await compactable(transaction, before)
        .select(['documentRevision.id', 'documentRevision.storageObjectId'])
        .where('documentRevision.documentId', '=', documentId)
        .limit(limit)
        .execute()
      if (revisions.length === 0) return { revisions: 0, bytes: 0 }
      await transaction
        .deleteFrom('documentRevision')
        .where(
          'id',
          'in',
          revisions.map((revision) => revision.id)
        )
        .execute()
      const freed = await unreferencedObjects(transaction)
        .select('byteSize')
        .where('id', 'in', uniq(revisions.map((revision) => revision.storageObjectId)))
        .execute()
      const bytes = sumBy(freed, (object) => Number(object.byteSize))
      if (bytes > 0) {
        await transaction
          .updateTable('workspaceStorageUsage')
          .set({
            committedBytes: (expression) => expression('committedBytes', '-', bytes),
            updatedAt: new Date()
          })
          .where('workspaceId', '=', workspaceId)
          .execute()
      }
      return { revisions: revisions.length, bytes }
    })
  }

  /** Deletes freed files from the object store, then their rows; a failure stays for next time. */
  async function sweepObjects(batchSize: number, result: RevisionCompactionResult) {
    const freed = await unreferencedObjects(database)
      .select(['id', 'objectKey'])
      .limit(batchSize)
      .execute()
    for (const object of freed) {
      try {
        await objects.delete(object.objectKey)
        await database
          .deleteFrom('storageObject')
          .where('id', '=', object.id)
          .where(unreferencedObject)
          .execute()
        result.objectsDeleted++
      } catch {
        result.failed++
      }
    }
  }

  return {
    async compactRevisions(input) {
      const now = input.now ?? new Date()
      const before = new Date(now.getTime() - input.graceMs)
      const result: RevisionCompactionResult = {
        versionsPruned: await pruneVersions(now, input.batchSize),
        revisionsDeleted: 0,
        objectsDeleted: 0,
        bytesReclaimed: 0,
        failed: 0
      }
      const candidates = await compactable(database, before)
        .select(['documentRevision.documentId', 'document.workspaceId'])
        .limit(input.batchSize)
        .execute()
      let capacity = input.batchSize
      for (const [documentId, rows] of Object.entries(
        groupBy(candidates, (row) => row.documentId)
      )) {
        const workspaceId = rows[0]?.workspaceId
        if (!workspaceId || capacity <= 0) continue
        try {
          const compacted = await compactDocument(documentId, workspaceId, before, capacity)
          capacity -= compacted.revisions
          result.revisionsDeleted += compacted.revisions
          result.bytesReclaimed += compacted.bytes
        } catch {
          result.failed++
        }
      }
      await sweepObjects(input.batchSize, result)
      return result
    }
  }
}
