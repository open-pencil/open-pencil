import type { TrashedDocument, WorkspaceRole } from '#cloud/contract'
import { documentRoleCan, workspaceRoleCan } from '#cloud/server/auth/access-control'
import { createDocumentCleanupService } from '#cloud/server/cleanup'
import type { CloudDatabase } from '#cloud/server/db'
import type { CloudErrorReporter } from '#cloud/server/errors'
import type { ObjectStore } from '#cloud/server/objects'
import { compact, uniq } from 'es-toolkit'
import type { Kysely, Transaction } from 'kysely'
import * as v from 'valibot'

import { trashedDocumentAllows } from './access'
import { DocumentForbiddenError, DocumentNotFoundError, DocumentPurgeFailedError } from './errors'
import { markPurged } from './purge'

const uuidSchema = v.pipe(v.string(), v.uuid())

const WORKSPACE_ROLES: WorkspaceRole[] = ['admin', 'editor', 'viewer']

/** The workspace roles whose members may delete any document there, and so restore it. */
const RESTORING_ROLES = WORKSPACE_ROLES.filter((role) =>
  workspaceRoleCan(role, { document: ['delete'] })
)

export type DocumentTrashOptions = {
  /** How long a deleted document stays in Trash before the cleanup worker deletes it for good. */
  retentionMs: number
  /**
   * How long a document deleted forever keeps its files, out of sight, before cleanup destroys
   * it; 0 destroys it at once.
   */
  purgeGraceMs: number
  /** How long a cleanup claim holds before another pass may take the document over. */
  leaseDurationMs: number
  /** Where destroying a document deleted forever with no grace reports a failure. */
  reportError?: CloudErrorReporter
}

/** A deployment's defaults: 30 days in Trash, 7 days' grace, and a five-minute cleanup lease. */
export const DEFAULT_TRASH_OPTIONS: DocumentTrashOptions = {
  retentionMs: 30 * 24 * 60 * 60_000,
  purgeGraceMs: 7 * 24 * 60 * 60_000,
  leaseDurationMs: 5 * 60_000
}

/** The names of the accounts these IDs belong to; IDs that are not accounts are left out. */
async function accountNames(
  database: Kysely<CloudDatabase>,
  ids: (string | null)[]
): Promise<Map<string, string>> {
  const accounts = uniq(compact(ids)).filter((id) => v.is(uuidSchema, id))
  if (accounts.length === 0) return new Map()
  const users = await database
    .selectFrom('user')
    .select(['id', 'name'])
    .where('id', 'in', accounts)
    .execute()
  return new Map(users.map((user) => [user.id, user.name]))
}

function toISOString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}

/**
 * Trash: documents deleted in the person's workspaces that cleanup has not removed yet. Whoever
 * may delete a document may restore it; its owner and workspace administrators may also delete
 * it forever, which takes it out of Trash and off their storage at once (see `markPurged`).
 */
export function createDocumentTrash(
  database: Kysely<CloudDatabase>,
  objects: ObjectStore,
  options: DocumentTrashOptions
) {
  const cleanup = createDocumentCleanupService(database, objects, {
    reportError: options.reportError
  })

  /** Deleted after this moment, a document is still in Trash. */
  function retainedSince(now: Date): Date {
    return new Date(now.getTime() - options.retentionMs)
  }

  return {
    async list(userId: string, now = new Date()): Promise<TrashedDocument[]> {
      const rows = await database
        .selectFrom('document')
        .innerJoin('workspaceMember', (join) =>
          join
            .onRef('workspaceMember.workspaceId', '=', 'document.workspaceId')
            .on('workspaceMember.userId', '=', userId)
        )
        .innerJoin('workspace', 'workspace.id', 'document.workspaceId')
        .select([
          'document.id',
          'document.workspaceId',
          'workspace.name as workspaceName',
          'document.name',
          'document.kind',
          'document.createdBy',
          'document.deletedAt',
          'document.deletedBy',
          'workspaceMember.role'
        ])
        .where('document.deletedAt', '>', retainedSince(now))
        .where('document.purgedAt', 'is', null)
        .where('document.cleanupClaimId', 'is', null)
        .where('document.disabledAt', 'is', null)
        .where((expression) =>
          expression.or([
            expression('workspaceMember.role', 'in', RESTORING_ROLES),
            expression('document.createdBy', '=', userId)
          ])
        )
        .orderBy('document.deletedAt', 'desc')
        .execute()
      const names = await accountNames(
        database,
        rows.map((row) => row.deletedBy)
      )
      return rows.flatMap(({ createdBy, deletedAt, deletedBy, role, ...row }) => {
        if (deletedAt === null) return []
        const deleted = new Date(deletedAt)
        const deleterName = deletedBy === null ? undefined : names.get(deletedBy)
        return {
          ...row,
          deletedAt: toISOString(deletedAt),
          deletedBy: deleterName === undefined ? null : { name: deleterName },
          purgeAt: new Date(deleted.getTime() + options.retentionMs).toISOString(),
          canPurge:
            workspaceRoleCan(role, { document: ['purge'] }) ||
            (createdBy === userId && documentRoleCan('owner', { document: ['purge'] }))
        }
      })
    },

    /** Puts a document back where it was; it counted toward storage all along, so no quota check. */
    async restore(userId: string, documentId: string, now = new Date()): Promise<void> {
      await database.transaction().execute(async (transaction) => {
        await lockInTrash(transaction, userId, documentId, now)
        await transaction
          .updateTable('document')
          .set({ deletedAt: null, deletedBy: null })
          .where('id', '=', documentId)
          .execute()
      })
    },

    /**
     * Deletes a document in Trash forever, for the person: it leaves Trash and their storage now,
     * and cleanup destroys it once the deployment's grace passes, or at once without one.
     */
    async purge(userId: string, documentId: string, now = new Date()): Promise<void> {
      await database.transaction().execute(async (transaction) => {
        await lockInTrash(transaction, userId, documentId, now)
        if (!(await trashedDocumentAllows(transaction, userId, documentId, 'purge'))) {
          throw new DocumentForbiddenError()
        }
        await markPurged(transaction, [documentId], userId, now)
      })
      if (options.purgeGraceMs > 0) return
      try {
        // A save still in flight holds it for the next cleanup pass; it is out of Trash already.
        await cleanup.destroyPurgedDocument(documentId, {
          leaseDurationMs: options.leaseDurationMs,
          now
        })
      } catch (error) {
        throw new DocumentPurgeFailedError(`Document ${documentId} could not be destroyed`, {
          cause: error
        })
      }
    }
  }

  /**
   * Holds a document in Trash until the transaction ends: deleted, not forever, inside retention,
   * and not being cleaned, by someone who may restore it; anything else is not found.
   */
  async function lockInTrash(
    transaction: Transaction<CloudDatabase>,
    userId: string,
    documentId: string,
    now: Date
  ): Promise<void> {
    const document = await transaction
      .selectFrom('document')
      .select(['deletedAt', 'purgedAt', 'cleanupClaimId'])
      .where('id', '=', documentId)
      .forUpdate()
      .executeTakeFirst()
    const inTrash =
      document?.deletedAt != null &&
      document.purgedAt === null &&
      document.cleanupClaimId === null &&
      new Date(document.deletedAt) > retainedSince(now)
    if (!inTrash || !(await trashedDocumentAllows(transaction, userId, documentId, 'delete'))) {
      throw new DocumentNotFoundError()
    }
  }
}

export type DocumentTrash = ReturnType<typeof createDocumentTrash>
