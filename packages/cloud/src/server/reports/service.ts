import type { FileDocumentReportInput } from '#cloud/contract'
import type { EmailLocale } from '#cloud/email'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import type { TransactionalEmailService } from '#cloud/server/email'
import type { DocumentSharingService } from '#cloud/server/sharing'
import type { Kysely } from 'kysely'

/**
 * How many reports one person, or guest, may file about one link in a day, and how many a link
 * may gather from everyone, since a guest names themselves and could otherwise flood the queue.
 */
export const DOCUMENT_REPORT_BUDGET = {
  windowMs: 24 * 60 * 60 * 1000,
  perReporter: 3,
  perShare: 50
} as const

/** How much of a description an administrator's email quotes; the console shows all of it. */
const EMAIL_DESCRIPTION_CHARACTERS = 500

/** A report past the reporter's or the link's daily budget. */
export class DocumentReportLimitError extends Error {
  override readonly name = 'DocumentReportLimitError'
}

export type DocumentReportServiceOptions = {
  sharing: Pick<DocumentSharingService, 'resolveShare'>
  email?: TransactionalEmailService
  /** Who hears of a new report: the deployment's administrators. */
  adminRecipients: readonly string[]
  publicURL: string
}

export function createDocumentReportService(
  database: Kysely<CloudDatabase>,
  options: DocumentReportServiceOptions
) {
  return {
    /**
     * Files a report about the document a share link opens, for someone the link lets in, and
     * tells the deployment's administrators. It answers nothing about the document, so a report
     * never tells its reporter more than the link already did.
     */
    async file(
      shareId: string,
      input: FileDocumentReportInput,
      actor?: CloudActor,
      /** The language the reporter's browser asked for, to reply in without an account's own. */
      replyLocale: EmailLocale | null = null
    ): Promise<void> {
      const resolved = await options.sharing.resolveShare(
        shareId,
        { secret: input.secret, guestId: input.guestId },
        actor
      )
      const reporterUserId = actor?.userId ?? null
      const reporterGuestId = actor ? null : (input.guestId ?? null)
      const since = new Date(Date.now() - DOCUMENT_REPORT_BUDGET.windowMs)
      await database.transaction().execute(async (transaction) => {
        const [byReporter, byShare] = await Promise.all([
          transaction
            .selectFrom('documentReport')
            .select((expression) => expression.fn.countAll<string>().as('count'))
            .where('shareId', '=', shareId)
            .where('createdAt', '>', since)
            .where((expression) => {
              if (reporterUserId) return expression('reporterUserId', '=', reporterUserId)
              if (reporterGuestId) return expression('reporterGuestId', '=', reporterGuestId)
              return expression.and([
                expression('reporterUserId', 'is', null),
                expression('reporterGuestId', 'is', null)
              ])
            })
            .executeTakeFirstOrThrow(),
          transaction
            .selectFrom('documentReport')
            .select((expression) => expression.fn.countAll<string>().as('count'))
            .where('shareId', '=', shareId)
            .where('createdAt', '>', since)
            .executeTakeFirstOrThrow()
        ])
        if (
          Number(byReporter.count) >= DOCUMENT_REPORT_BUDGET.perReporter ||
          Number(byShare.count) >= DOCUMENT_REPORT_BUDGET.perShare
        ) {
          throw new DocumentReportLimitError()
        }
        const id = crypto.randomUUID()
        const replyEmail = input.replyEmail ?? actor?.email ?? null
        await transaction
          .insertInto('documentReport')
          .values({
            id,
            documentId: resolved.documentId,
            shareId,
            reporterUserId,
            reporterGuestId,
            replyEmail,
            replyLocale,
            reason: input.reason,
            description: input.description
          })
          .execute()
        if (!options.email) return
        const document = await transaction
          .selectFrom('document')
          .select('name')
          .where('id', '=', resolved.documentId)
          .executeTakeFirstOrThrow()
        // Whoever left an address hears that the report arrived, and later what was decided.
        if (replyEmail) {
          await options.email.enqueue(
            {
              idempotencyKey: `document-report-received/${id}`,
              kind: 'document-report-received',
              recipientEmail: replyEmail,
              fallbackLocale: replyLocale,
              payload: { documentName: document.name }
            },
            transaction
          )
        }
        for (const recipientEmail of options.adminRecipients) {
          await options.email.enqueue(
            {
              idempotencyKey: `document-report/${id}/${recipientEmail}`,
              kind: 'document-report',
              recipientEmail,
              payload: {
                documentName: document.name,
                reason: input.reason,
                description: input.description.slice(0, EMAIL_DESCRIPTION_CHARACTERS),
                actionURL: new URL('/admin/reports', options.publicURL).href
              }
            },
            transaction
          )
        }
      })
    }
  }
}

export type DocumentReportService = ReturnType<typeof createDocumentReportService>
