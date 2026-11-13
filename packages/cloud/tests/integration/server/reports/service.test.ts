import { describe, expect, test } from 'bun:test'

import { seedSharing } from '#cloud-tests/helpers/sharing'
import { createAdminDocumentService, createAdminReportService } from '#cloud/admin'
import {
  createDocumentReportService,
  DOCUMENT_REPORT_BUDGET,
  DocumentReportLimitError,
  createTransactionalEmailService,
  DocumentShareInvalidError,
  type TransactionalEmailService
} from '#cloud/server'
import { decryptTransactionalEmailPayload } from '#cloud/server/email'

type Context = Awaited<ReturnType<typeof seedSharing>>

/** An email service that keeps what it was asked to send. */
function capturedEmail() {
  const sent: { kind: string; recipientEmail: string; payload: unknown }[] = []
  const email: TransactionalEmailService = {
    async enqueue(input) {
      sent.push({ kind: input.kind, recipientEmail: input.recipientEmail, payload: input.payload })
      return crypto.randomUUID()
    },
    async deliverPending() {
      return { claimed: 0, accepted: 0, retrying: 0, failed: 0, suppressed: 0 }
    }
  }
  return { email, sent }
}

async function reporting(context: Context) {
  const { email, sent } = capturedEmail()
  const reports = createDocumentReportService(context.runtime.database, {
    sharing: context.sharing,
    email,
    adminRecipients: ['admin@example.com'],
    publicURL: 'https://cloud.example.com'
  })
  const capability = await context.sharing.createShare('owner', context.documentId, {
    permission: 'view'
  })
  const report = (overrides: { secret?: string; guestId?: string } = {}) =>
    reports.file(capability.share.id, {
      secret: overrides.secret ?? capability.secret,
      guestId: overrides.guestId ?? 'guest-0123456789abcdef',
      reason: 'spam-phishing',
      description: 'A fake sign-in page'
    })
  return { reports, capability, report, sent }
}

describe('document reports', () => {
  test('files a report a link lets someone see, and tells the administrators', async () => {
    const context = await seedSharing()
    try {
      const { capability, report, sent } = await reporting(context)
      await report()
      expect(
        await context.runtime.database
          .selectFrom('documentReport')
          .select(['documentId', 'shareId', 'reporterGuestId', 'reason', 'status'])
          .execute()
      ).toEqual([
        {
          documentId: context.documentId,
          shareId: capability.share.id,
          reporterGuestId: 'guest-0123456789abcdef',
          reason: 'spam-phishing',
          status: 'open'
        }
      ])
      expect(sent).toEqual([
        {
          kind: 'document-report',
          recipientEmail: 'admin@example.com',
          payload: {
            documentName: 'Homepage',
            reason: 'spam-phishing',
            description: 'A fake sign-in page',
            actionURL: 'https://cloud.example.com/admin/reports'
          }
        }
      ])
    } finally {
      await context.runtime.close()
    }
  })

  test('refuses a report through a wrong secret or a revoked link', async () => {
    const context = await seedSharing()
    try {
      const { capability, report } = await reporting(context)
      await expect(report({ secret: 'f'.repeat(48) })).rejects.toBeInstanceOf(
        DocumentShareInvalidError
      )
      await context.sharing.revokeShare('owner', context.documentId, capability.share.id)
      await expect(report()).rejects.toBeInstanceOf(DocumentShareInvalidError)
      expect(
        await context.runtime.database.selectFrom('documentReport').select('id').execute()
      ).toEqual([])
    } finally {
      await context.runtime.close()
    }
  })

  test('caps the reports one guest files about a link in a day', async () => {
    const context = await seedSharing()
    try {
      const { report } = await reporting(context)
      for (let index = 0; index < DOCUMENT_REPORT_BUDGET.perReporter; index++) await report()
      await expect(report()).rejects.toBeInstanceOf(DocumentReportLimitError)
      // Someone else may still report it.
      await report({ guestId: 'another-guest-0123456789' })
    } finally {
      await context.runtime.close()
    }
  })

  test('tells a reporter who left an address that the report arrived, and what was decided', async () => {
    const context = await seedSharing()
    // The real outbox, in each decision's own transaction, so a kind the table refuses fails here.
    const email = createTransactionalEmailService(context.runtime.database, {
      encryptionSecret: 'integration-test-secret-at-least-32-characters',
      from: 'cloud@example.com'
    })
    try {
      const reports = createDocumentReportService(context.runtime.database, {
        sharing: context.sharing,
        email,
        adminRecipients: [],
        publicURL: 'https://cloud.example.com'
      })
      const capability = await context.sharing.createShare('owner', context.documentId, {
        permission: 'view'
      })
      const file = (guestId: string, replyEmail: string) =>
        reports.file(
          capability.share.id,
          {
            secret: capability.secret,
            guestId,
            reason: 'spam-phishing',
            description: 'A fake sign-in page',
            replyEmail
          },
          undefined,
          'de'
        )
      await file('guest-0123456789abcdef', 'first@example.com')
      await file('guest-fedcba9876543210', 'second@example.com')
      const [dismissed] = await context.runtime.database
        .selectFrom('documentReport')
        .select('id')
        .where('replyEmail', '=', 'first@example.com')
        .execute()
      const replies = { email, contactEmail: 'abuse@example.com' }
      // One report is dismissed; blocking the document then answers the other, still open.
      await createAdminReportService(context.runtime.database, replies).resolve(
        'admin-user',
        dismissed?.id ?? '',
        'dismissed'
      )
      await createAdminDocumentService(context.runtime.database, replies).disable(
        'admin-user',
        context.documentId,
        undefined
      )

      const queued = await context.runtime.database
        .selectFrom('transactionalEmail')
        .select(['id', 'kind', 'recipientEmailNormalized', 'locale', 'payloadEncrypted'])
        // Ordered by what they are, never by when, which two writes can share.
        .orderBy('kind')
        .orderBy('recipientEmailNormalized')
        .execute()
      expect(queued.map((row) => [row.kind, row.recipientEmailNormalized, row.locale])).toEqual([
        ['document-report-decided', 'first@example.com', 'de'],
        ['document-report-decided', 'second@example.com', 'de'],
        ['document-report-received', 'first@example.com', 'de'],
        ['document-report-received', 'second@example.com', 'de']
      ])
      // Read the sealed decisions back as delivery would.
      const decisions = await Promise.all(
        queued
          .filter((row) => row.kind === 'document-report-decided')
          .map(
            async (row) =>
              (
                await decryptTransactionalEmailPayload(
                  'integration-test-secret-at-least-32-characters',
                  row.id,
                  row.kind,
                  row.payloadEncrypted ?? ''
                )
              ).payload
          )
      )
      expect(decisions).toEqual([
        { documentName: 'Homepage', outcome: 'dismissed', contactEmail: 'abuse@example.com' },
        { documentName: 'Homepage', outcome: 'actioned', contactEmail: 'abuse@example.com' }
      ])
    } finally {
      await context.runtime.close()
    }
  })
})
