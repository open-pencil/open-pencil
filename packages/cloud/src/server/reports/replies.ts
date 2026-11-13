import type { CloudDatabase } from '#cloud/server/db'
import type { TransactionalEmailService } from '#cloud/server/email'
import type { Transaction } from 'kysely'

/** How reporters hear back: through email, with the deployment's abuse address to disagree. */
export type ReportReplies = {
  email?: TransactionalEmailService
  /** Where a reporter writes to disagree with a decision: the deployment's abuse address. */
  contactEmail?: string
}

/**
 * Tells each reporter who left an address what the administrators decided about their report:
 * the document blocked, or left as it was. Each report is answered once, in the transaction that
 * decides it, so a decision that rolls back tells nobody.
 */
export async function tellReporters(
  transaction: Transaction<CloudDatabase>,
  replies: ReportReplies,
  reportIds: readonly string[],
  outcome: 'actioned' | 'dismissed'
): Promise<void> {
  const { email } = replies
  if (!email || reportIds.length === 0) return
  const reports = await transaction
    .selectFrom('documentReport')
    .innerJoin('document', 'document.id', 'documentReport.documentId')
    .select([
      'documentReport.id',
      'documentReport.replyEmail',
      'documentReport.replyLocale',
      'document.name'
    ])
    .where('documentReport.id', 'in', reportIds)
    .where('documentReport.replyEmail', 'is not', null)
    .execute()
  for (const report of reports) {
    if (!report.replyEmail) continue
    await email.enqueue(
      {
        idempotencyKey: `document-report-decided/${report.id}`,
        kind: 'document-report-decided',
        recipientEmail: report.replyEmail,
        fallbackLocale: report.replyLocale,
        payload: {
          documentName: report.name,
          outcome,
          contactEmail: replies.contactEmail ?? null
        }
      },
      transaction
    )
  }
}
