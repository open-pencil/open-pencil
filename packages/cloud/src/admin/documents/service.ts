import { AdminDomainError } from '#cloud/admin/errors'
import {
  containsPattern,
  countEachFilter,
  listSearch,
  listWindow,
  type AdminListQuery,
  type ListFilters
} from '#cloud/admin/list'
import { isUUID } from '#cloud/admin/schema'
import {
  cloudAdminDocumentFilterSchema,
  type CloudAdminDocument,
  type CloudAdminDocumentFilter
} from '#cloud/contract'
import { userIdText, type CloudDatabase } from '#cloud/server/db'
import { unmarkPurged } from '#cloud/server/documents/purge'
import type { TransactionalEmailService } from '#cloud/server/email'
import { tellReporters } from '#cloud/server/reports'
import { dateString } from '#cloud/server/sharing/contracts'
import { uniq } from 'es-toolkit'
import type { ExpressionBuilder, Kysely, Transaction } from 'kysely'

type DocumentExpression = ExpressionBuilder<CloudDatabase, 'document'>

/** Whether reports about the document are still waiting for a decision. */
const reported = (expression: DocumentExpression) =>
  expression.exists(
    expression
      .selectFrom('documentReport')
      .select('documentReport.id')
      .whereRef('documentReport.documentId', '=', 'document.id')
      .where('documentReport.status', '=', 'open')
  )

const live = (expression: DocumentExpression) => expression('document.deletedAt', 'is', null)

const FILTERS: ListFilters<CloudAdminDocumentFilter, 'document'> = {
  all: live,
  reported: (expression) => expression.and([live(expression), reported(expression)]),
  disabled: (expression) =>
    expression.and([live(expression), expression('document.disabledAt', 'is not', null)]),
  purged: (expression) => expression('document.purgedAt', 'is not', null)
}

/**
 * What the console lists: live documents, and those deleted forever an administrator can still
 * restore, inside the grace and not yet being destroyed.
 */
function listable(graceSince: Date) {
  return (expression: DocumentExpression) =>
    expression.or([
      live(expression),
      expression.and([
        expression('document.purgedAt', '>', graceSince),
        expression('document.cleanupClaimId', 'is', null)
      ])
    ])
}

/** Documents whose name, ID, or maker's name or email has the search in it. */
function searchCondition(search: string) {
  const pattern = containsPattern(search)
  return (expression: DocumentExpression) =>
    expression.or([
      expression('document.name', 'ilike', pattern),
      expression(expression.cast('document.id', 'text'), '=', search.toLowerCase()),
      expression.exists(
        expression
          .selectFrom('user')
          .select('user.id')
          .whereRef(userIdText, '=', 'document.createdBy')
          .where((inner) =>
            inner.or([inner('user.email', 'ilike', pattern), inner('user.name', 'ilike', pattern)])
          )
      )
    ])
}

/**
 * The documents with these IDs as the console shows them, in no particular order; with
 * `purgeGraceMs`, when cleanup destroys one deleted forever.
 */
export async function adminDocuments(
  database: Kysely<CloudDatabase>,
  documentIds: readonly string[],
  purgeGraceMs?: number
): Promise<Map<string, CloudAdminDocument>> {
  const ids = uniq(documentIds).filter(isUUID)
  if (ids.length === 0) return new Map()
  const rows = await database
    .selectFrom('document')
    .innerJoin('workspace', 'workspace.id', 'document.workspaceId')
    .select((expression) => [
      'document.id',
      'document.name',
      'document.createdBy',
      'document.createdAt',
      'document.updatedAt',
      'document.disabledAt',
      'document.disabledReason',
      'document.purgedAt',
      'workspace.id as workspaceId',
      'workspace.name as workspaceName',
      expression
        .selectFrom('documentReport')
        .select((inner) => inner.fn.countAll<string>().as('count'))
        .whereRef('documentReport.documentId', '=', 'document.id')
        .where('documentReport.status', '=', 'open')
        .as('openReports')
    ])
    .where('document.id', 'in', ids)
    .execute()
  const ownerIds = uniq(rows.map((row) => row.createdBy)).filter(isUUID)
  const owners = ownerIds.length
    ? await database
        .selectFrom('user')
        .select(['id', 'name', 'email'])
        .where('id', 'in', ownerIds)
        .execute()
    : []
  const ownerById = new Map(owners.map((owner) => [owner.id, owner]))
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        workspace: { id: row.workspaceId, name: row.workspaceName },
        owner: ownerById.get(row.createdBy) ?? null,
        createdAt: dateString(row.createdAt) ?? '',
        updatedAt: dateString(row.updatedAt) ?? '',
        disabledAt: dateString(row.disabledAt),
        disabledReason: row.disabledReason,
        openReports: Number(row.openReports ?? 0),
        purgedAt: dateString(row.purgedAt),
        destroyedAt:
          row.purgedAt === null || purgeGraceMs === undefined
            ? null
            : new Date(new Date(row.purgedAt).getTime() + purgeGraceMs).toISOString()
      }
    ])
  )
}

type AuditDatabase = Kysely<CloudDatabase> | Transaction<CloudDatabase>

/** Records an administrator's action on a document, a link, or a report. */
export async function auditContentAction(
  database: AuditDatabase,
  actorId: string,
  action: string,
  subject: { type: 'document' | 'document-share' | 'document-report'; id: string },
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await database
    .insertInto('adminAuditEvent')
    .values({
      id: crypto.randomUUID(),
      actorUserId: actorId,
      action,
      subjectType: subject.type,
      subjectId: subject.id,
      metadata
    })
    .execute()
}

/** A document that is not deleted, held until the transaction ends; none is not found. */
function lockedDocument(transaction: Transaction<CloudDatabase>, documentId: string) {
  return transaction
    .selectFrom('document')
    .select(['id', 'disabledAt'])
    .where('id', '=', documentId)
    .where('deletedAt', 'is', null)
    .forUpdate()
    .executeTakeFirstOrThrow()
}

export type AdminDocumentServiceOptions = {
  /**
   * Ends a taken-down document's live rooms, saving them, so a takedown reaches open tabs at once
   * and a restore loses no edit.
   */
  closeRooms?: (documentId: string) => void
  /** How long a document deleted forever waits before cleanup destroys it; 0 when not given. */
  purgeGraceMs?: number
  /**
   * Tells the owner of a document's workspace when it is blocked and restored. Without it, or
   * without the server's address its link needs, nobody is told.
   */
  email?: TransactionalEmailService
  publicURL?: string
  /** Where an owner writes to contest a block: the deployment's abuse address. */
  contactEmail?: string
}

/** The owner of a document's workspace, and the document's name, to tell about a block. */
async function documentOwner(transaction: Transaction<CloudDatabase>, documentId: string) {
  const document = await transaction
    .selectFrom('document')
    .innerJoin('workspace', 'workspace.id', 'document.workspaceId')
    .select(['document.name', 'workspace.ownerId'])
    .where('document.id', '=', documentId)
    .executeTakeFirst()
  if (!document) return undefined
  const owner = await transaction
    .selectFrom('user')
    .select(['name', 'email'])
    .where((expression) => expression(userIdText(expression), '=', document.ownerId))
    .executeTakeFirst()
  return owner && { ...owner, documentName: document.name }
}

export function createAdminDocumentService(
  database: Kysely<CloudDatabase>,
  options: AdminDocumentServiceOptions = {}
) {
  const purgeGraceMs = options.purgeGraceMs ?? 0
  const { email, publicURL } = options
  const graceSince = (now: Date) => new Date(now.getTime() - purgeGraceMs)
  return {
    /** A page of documents, newest change first, and how many match the search under each filter. */
    async list(query: AdminListQuery<CloudAdminDocumentFilter> = {}) {
      const search = listSearch(query)
      const filter = query.filter ?? 'all'
      const { limit, offset } = listWindow(query)
      let searched = database.selectFrom('document').where(listable(graceSince(new Date())))
      if (search) searched = searched.where(searchCondition(search))
      const counts = await countEachFilter(
        searched,
        cloudAdminDocumentFilterSchema.options,
        FILTERS
      )
      const page = await searched
        .where(FILTERS[filter])
        .select('document.id')
        .orderBy('document.updatedAt', 'desc')
        .orderBy('document.id')
        .limit(limit)
        .offset(offset)
        .execute()
      const documents = await adminDocuments(
        database,
        page.map((row) => row.id),
        purgeGraceMs
      )
      return {
        documents: page.flatMap((row) => documents.get(row.id) ?? []),
        total: counts[filter],
        counts
      }
    },

    /**
     * Takes a document down: it opens for nobody, its owner included, its links stop working,
     * and its live rooms close, saved. Its open reports count as acted on. Nothing is deleted and
     * its collaboration epoch stays, so enabling it gives everything back, live edits included.
     */
    async disable(actorId: string, documentId: string, reason: string | undefined): Promise<void> {
      await database.transaction().execute(async (transaction) => {
        const document = await lockedDocument(transaction, documentId)
        if (document.disabledAt) return
        const disabledAt = new Date()
        await transaction
          .updateTable('document')
          .set({ disabledAt, disabledReason: reason ?? null })
          .where('id', '=', documentId)
          .execute()
        const reports = await transaction
          .updateTable('documentReport')
          .set({ status: 'actioned', resolvedAt: new Date(), resolvedBy: actorId })
          .where('documentId', '=', documentId)
          .where('status', '=', 'open')
          .returning('id')
          .execute()
        // Everyone who reported it and left an address hears it was blocked.
        await tellReporters(
          transaction,
          { email, contactEmail: options.contactEmail },
          reports.map((report) => report.id),
          'blocked'
        )
        await auditContentAction(
          transaction,
          actorId,
          'document.disabled',
          { type: 'document', id: documentId },
          reason ? { reason } : {}
        )
        // Told in the same transaction, so a block that rolls back sends nothing.
        const owner = email && publicURL && (await documentOwner(transaction, documentId))
        if (owner) {
          await email.enqueue(
            {
              idempotencyKey: `document-blocked/${documentId}/${disabledAt.getTime()}`,
              kind: 'document-blocked',
              recipientEmail: owner.email,
              payload: {
                name: owner.name || null,
                documentName: owner.documentName,
                reason: reason ?? null,
                contactEmail: options.contactEmail ?? null,
                actionURL: publicURL
              }
            },
            transaction
          )
        }
      })
      options.closeRooms?.(documentId)
    },

    /** Puts a document taken down back where it was. */
    async enable(actorId: string, documentId: string): Promise<void> {
      await database.transaction().execute(async (transaction) => {
        const document = await lockedDocument(transaction, documentId)
        if (!document.disabledAt) return
        await transaction
          .updateTable('document')
          .set({ disabledAt: null, disabledReason: null })
          .where('id', '=', documentId)
          .execute()
        await auditContentAction(transaction, actorId, 'document.enabled', {
          type: 'document',
          id: documentId
        })
        const owner = email && publicURL && (await documentOwner(transaction, documentId))
        if (owner) {
          await email.enqueue(
            {
              idempotencyKey: `document-restored/${documentId}/${Date.now()}`,
              kind: 'document-restored',
              recipientEmail: owner.email,
              payload: {
                name: owner.name || null,
                documentName: owner.documentName,
                actionURL: publicURL
              }
            },
            transaction
          )
        }
      })
    },

    /**
     * Brings back a document someone deleted forever, while its grace lasts: it is live again in
     * its workspace, not in Trash, and counts toward the workspace's storage again, over its plan
     * or not. A document cleanup is destroying, or whose workspace has nobody left in it, can't be.
     */
    async undelete(actorId: string, documentId: string, now = new Date()): Promise<void> {
      await database.transaction().execute(async (transaction) => {
        const document = await transaction
          .selectFrom('document')
          .select(['id', 'workspaceId', 'purgedAt', 'purgedBytes', 'cleanupClaimId'])
          .where('id', '=', documentId)
          .forUpdate()
          .executeTakeFirst()
        // Cleanup may have destroyed it since the list was loaded.
        if (
          !document ||
          document.purgedAt === null ||
          document.cleanupClaimId !== null ||
          new Date(document.purgedAt) <= graceSince(now)
        ) {
          throw new AdminDomainError(
            'document_not_restorable',
            'Only a document deleted forever, inside its grace, can be restored'
          )
        }
        const member = await transaction
          .selectFrom('workspaceMember')
          .select('userId')
          .where('workspaceId', '=', document.workspaceId)
          .limit(1)
          .executeTakeFirst()
        if (!member) {
          throw new AdminDomainError('workspace_gone', 'The document’s workspace has nobody in it')
        }
        await unmarkPurged(transaction, {
          id: document.id,
          workspaceId: document.workspaceId,
          purgedBytes: Number(document.purgedBytes)
        })
        await auditContentAction(
          transaction,
          actorId,
          'document.undeleted',
          { type: 'document', id: documentId },
          { workspaceId: document.workspaceId }
        )
      })
    },

    /**
     * Revokes a share link for good, as its owner can: the collaboration epoch moves on, so the
     * link's guests lose their tickets, while members keep editing.
     */
    async revokeShare(actorId: string, shareId: string): Promise<void> {
      await database.transaction().execute(async (transaction) => {
        const share = await transaction
          .selectFrom('documentShare')
          .select(['id', 'documentId', 'revokedAt'])
          .where('id', '=', shareId)
          .forUpdate()
          .executeTakeFirstOrThrow()
        if (share.revokedAt) return
        await transaction
          .updateTable('documentShare')
          .set({ revokedAt: new Date(), updatedAt: new Date() })
          .where('id', '=', shareId)
          .execute()
        await transaction
          .updateTable('document')
          .set((expression) => ({ collaborationEpoch: expression('collaborationEpoch', '+', 1) }))
          .where('id', '=', share.documentId)
          .execute()
        await auditContentAction(
          transaction,
          actorId,
          'document-share.revoked',
          { type: 'document-share', id: shareId },
          { documentId: share.documentId }
        )
      })
    }
  }
}

export type AdminDocumentService = ReturnType<typeof createAdminDocumentService>
