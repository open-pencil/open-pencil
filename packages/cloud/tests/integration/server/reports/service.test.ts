import { describe, expect, test } from 'bun:test'

import { seedSharing } from '#cloud-tests/helpers/sharing'
import {
  createDocumentReportService,
  DOCUMENT_REPORT_BUDGET,
  DocumentReportLimitError,
  DocumentShareInvalidError,
  type TransactionalEmailService
} from '#cloud/server'

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
})
