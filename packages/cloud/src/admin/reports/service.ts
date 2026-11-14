import { adminDocuments, auditContentAction } from '#cloud/admin/documents/service'
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
  cloudAdminReportFilterSchema,
  type CloudAdminReport,
  type CloudAdminReportFilter
} from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { tellReporters, type ReportReplies } from '#cloud/server/reports'
import { dateString } from '#cloud/server/sharing/contracts'
import { uniq } from 'es-toolkit'
import type { ExpressionBuilder, Kysely } from 'kysely'

type ReportExpression = ExpressionBuilder<CloudDatabase, 'documentReport'>

const FILTERS: ListFilters<CloudAdminReportFilter, 'documentReport'> = {
  open: (expression) => expression('documentReport.status', '=', 'open'),
  actioned: (expression) => expression('documentReport.status', '=', 'actioned'),
  dismissed: (expression) => expression('documentReport.status', '=', 'dismissed'),
  all: (expression) => expression.lit(true)
}

/** Reports whose description, reply address, or document's name has the search in it. */
function searchCondition(search: string) {
  const pattern = containsPattern(search)
  return (expression: ReportExpression) =>
    expression.or([
      expression('documentReport.description', 'ilike', pattern),
      expression('documentReport.replyEmail', 'ilike', pattern),
      expression.exists(
        expression
          .selectFrom('document')
          .select('document.id')
          .whereRef('document.id', '=', 'documentReport.documentId')
          .where('document.name', 'ilike', pattern)
      )
    ])
}

/** Reports' administration, which tells each reporter who left an address what it decided. */
export function createAdminReportService(
  database: Kysely<CloudDatabase>,
  replies: ReportReplies = {}
) {
  return {
    /** A page of reports, newest first, and how many match the search under each filter. */
    async list(query: AdminListQuery<CloudAdminReportFilter> = {}) {
      const search = listSearch(query)
      const filter = query.filter ?? 'open'
      const { limit, offset } = listWindow(query)
      let searched = database.selectFrom('documentReport')
      if (search) searched = searched.where(searchCondition(search))
      const counts = await countEachFilter(searched, cloudAdminReportFilterSchema.options, FILTERS)
      const rows = await searched
        .where(FILTERS[filter])
        .selectAll()
        .orderBy('createdAt', 'desc')
        .orderBy('id', 'desc')
        .limit(limit)
        .offset(offset)
        .execute()
      const shareIds = uniq(rows.flatMap((row) => (row.shareId ? [row.shareId] : [])))
      const reporterIds = uniq(
        rows.flatMap((row) => (row.reporterUserId ? [row.reporterUserId] : []))
      ).filter(isUUID)
      const [documents, shares, reporters] = await Promise.all([
        adminDocuments(
          database,
          rows.map((row) => row.documentId)
        ),
        shareIds.length
          ? database
              .selectFrom('documentShare')
              .select(['id', 'revokedAt'])
              .where('id', 'in', shareIds)
              .execute()
          : [],
        reporterIds.length
          ? database
              .selectFrom('user')
              .select(['id', 'name'])
              .where('id', 'in', reporterIds)
              .execute()
          : []
      ])
      const revoked = new Map(shares.map((share) => [share.id, share.revokedAt !== null]))
      const reporterNames = new Map(reporters.map((reporter) => [reporter.id, reporter.name]))
      const reports: CloudAdminReport[] = rows.flatMap((row) => {
        const document = documents.get(row.documentId)
        if (!document) return []
        return [
          {
            id: row.id,
            reason: row.reason,
            description: row.description,
            status: row.status,
            reporter: row.reporterUserId
              ? { id: row.reporterUserId, name: reporterNames.get(row.reporterUserId) ?? null }
              : null,
            replyEmail: row.replyEmail,
            createdAt: dateString(row.createdAt) ?? '',
            resolvedAt: dateString(row.resolvedAt),
            document,
            share: row.shareId
              ? { id: row.shareId, revoked: revoked.get(row.shareId) ?? true }
              : null
          }
        ]
      })
      return { reports, total: counts[filter], counts }
    },

    /** Closes an open report, as dismissed or as acted on; a closed one stays as it was. */
    async resolve(
      actorId: string,
      reportId: string,
      status: 'dismissed' | 'actioned'
    ): Promise<void> {
      await database.transaction().execute(async (transaction) => {
        const report = await transaction
          .selectFrom('documentReport')
          .select(['id', 'status', 'documentId'])
          .where('id', '=', reportId)
          .forUpdate()
          .executeTakeFirstOrThrow()
        if (report.status !== 'open') return
        await transaction
          .updateTable('documentReport')
          .set({ status, resolvedAt: new Date(), resolvedBy: actorId })
          .where('id', '=', reportId)
          .execute()
        await auditContentAction(
          transaction,
          actorId,
          `document-report.${status}`,
          { type: 'document-report', id: reportId },
          { documentId: report.documentId }
        )
        await tellReporters(transaction, replies, [reportId], status)
      })
    }
  }
}

export type AdminReportService = ReturnType<typeof createAdminReportService>
