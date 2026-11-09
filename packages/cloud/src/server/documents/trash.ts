import type { TrashedDocument, WorkspaceRole } from '#cloud/contract'
import { documentRoleCan, workspaceRoleCan } from '#cloud/server/auth/access-control'
import { createDocumentCleanupService } from '#cloud/server/cleanup'
import type { CloudDatabase } from '#cloud/server/db'
import type { ObjectStore } from '#cloud/server/objects'
import { compact, uniq } from 'es-toolkit'
import type { Kysely } from 'kysely'
import * as v from 'valibot'

import { trashedDocumentAllows } from './access'
import { DocumentForbiddenError, DocumentNotFoundError } from './errors'

const uuidSchema = v.pipe(v.string(), v.uuid())

const WORKSPACE_ROLES: WorkspaceRole[] = ['admin', 'editor', 'viewer']

/** The workspace roles whose members may delete any document there, and so restore it. */
const RESTORING_ROLES = WORKSPACE_ROLES.filter((role) =>
  workspaceRoleCan(role, { document: ['delete'] })
)

export type DocumentTrashOptions = {
  /** How long a deleted document stays in Trash before the cleanup worker deletes it for good. */
  retentionMs: number
  /** How long a cleanup claim holds before another pass may take the document over. */
  leaseDurationMs: number
}

/** A deployment's defaults: 30 days in Trash, and the cleanup worker's five-minute lease. */
export const DEFAULT_TRASH_OPTIONS: DocumentTrashOptions = {
  retentionMs: 30 * 24 * 60 * 60_000,
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
 * it for good, which hands it to the cleanup worker's own path at once.
 */
export function createDocumentTrash(
  database: Kysely<CloudDatabase>,
  objects: ObjectStore,
  options: DocumentTrashOptions
) {
  const cleanup = createDocumentCleanupService(database, objects)

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
        const document = await transaction
          .selectFrom('document')
          .select(['deletedAt', 'cleanupClaimId'])
          .where('id', '=', documentId)
          .forUpdate()
          .executeTakeFirst()
        if (
          !document?.deletedAt ||
          document.cleanupClaimId !== null ||
          new Date(document.deletedAt) <= retainedSince(now)
        ) {
          throw new DocumentNotFoundError()
        }
        if (!(await trashedDocumentAllows(transaction, userId, documentId, 'delete'))) {
          throw new DocumentNotFoundError()
        }
        await transaction
          .updateTable('document')
          .set({ deletedAt: null, deletedBy: null })
          .where('id', '=', documentId)
          .execute()
      })
    },

    async purge(userId: string, documentId: string, now = new Date()): Promise<void> {
      if (!(await trashedDocumentAllows(database, userId, documentId, 'delete'))) {
        throw new DocumentNotFoundError()
      }
      if (!(await trashedDocumentAllows(database, userId, documentId, 'purge'))) {
        throw new DocumentForbiddenError()
      }
      const purged = await cleanup.purgeDeletedDocument(documentId, {
        leaseDurationMs: options.leaseDurationMs,
        now
      })
      if (!purged) throw new DocumentNotFoundError()
    }
  }
}

export type DocumentTrash = ReturnType<typeof createDocumentTrash>
