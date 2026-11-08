import { describe, expect, test } from 'bun:test'

import { seedSharing } from '#cloud-tests/helpers/sharing'
import { createAdminDocumentService, createAdminReportService } from '#cloud/admin'
import {
  createCollaborationTicketService,
  createDocumentReportService,
  DocumentNotFoundError,
  DocumentShareInvalidError,
  resolveDocumentAccess
} from '#cloud/server'
import { listDocuments } from '#cloud/server/documents/repository'

const ADMIN = 'admin-user'

async function seed() {
  const context = await seedSharing()
  const ended: string[] = []
  const documents = createAdminDocumentService(context.runtime.database, {
    endRooms: (documentId) => ended.push(documentId)
  })
  const reportsAdmin = createAdminReportService(context.runtime.database)
  const capability = await context.sharing.createShare('owner', context.documentId, {
    permission: 'view'
  })
  const reports = createDocumentReportService(context.runtime.database, {
    sharing: context.sharing,
    adminRecipients: [],
    publicURL: 'https://cloud.example.com'
  })
  const fileReport = (guestId: string) =>
    reports.file(capability.share.id, {
      secret: capability.secret,
      guestId,
      reason: 'illegal',
      description: 'Not allowed here'
    })
  const tickets = createCollaborationTicketService({
    database: context.runtime.database,
    sharing: context.sharing,
    authSecret: 'integration-test-secret-at-least-32-characters',
    relayURL: 'wss://cloud.example.com/relay'
  })
  const owner = { userId: 'owner', email: 'owner@example.com', name: 'Owner' }
  const workspaceId = (
    await context.runtime.database
      .selectFrom('document')
      .select('workspaceId')
      .where('id', '=', context.documentId)
      .executeTakeFirstOrThrow()
  ).workspaceId
  /** Every way someone reaches the document, each true while it still lets them in. */
  const reachable = async () => ({
    owner:
      (await resolveDocumentAccess(context.runtime.database, 'owner', context.documentId)) !==
      undefined,
    link: await context.sharing
      .resolveShare(capability.share.id, { secret: capability.secret })
      .then(
        () => true,
        (error: unknown) => !(error instanceof DocumentShareInvalidError)
      ),
    ticket: await tickets.issueUserTicket(owner, context.documentId).then(
      () => true,
      (error: unknown) => !(error instanceof DocumentNotFoundError)
    ),
    listed: ((await listDocuments(context.runtime.database, 'owner', workspaceId)) ?? []).some(
      (document) => document.id === context.documentId
    )
  })
  return { context, documents, reportsAdmin, capability, fileReport, reachable, ended }
}

const audited = (context: Awaited<ReturnType<typeof seedSharing>>) =>
  context.runtime.database
    .selectFrom('adminAuditEvent')
    .select(['action', 'subjectType', 'subjectId'])
    .orderBy('createdAt')
    .execute()

describe('document takedown', () => {
  test('takes a document out of everyone’s reach until it is enabled again', async () => {
    const { context, documents, fileReport, reachable, ended } = await seed()
    try {
      await fileReport('guest-0123456789abcdef')
      expect(await reachable()).toEqual({ owner: true, link: true, ticket: true, listed: true })

      await documents.disable(ADMIN, context.documentId, 'Phishing')
      expect(await reachable()).toEqual({ owner: false, link: false, ticket: false, listed: false })
      expect(ended).toEqual([context.documentId])
      // Its open report counts as acted on.
      expect(
        await context.runtime.database.selectFrom('documentReport').select('status').execute()
      ).toEqual([{ status: 'actioned' }])

      await documents.enable(ADMIN, context.documentId)
      expect(await reachable()).toEqual({ owner: true, link: true, ticket: true, listed: true })
      expect(await audited(context)).toEqual([
        { action: 'document.disabled', subjectType: 'document', subjectId: context.documentId },
        { action: 'document.enabled', subjectType: 'document', subjectId: context.documentId }
      ])
    } finally {
      await context.runtime.close()
    }
  })

  test('revokes a link for good and ends its rooms', async () => {
    const { context, documents, capability, reachable, ended } = await seed()
    try {
      await documents.revokeShare(ADMIN, capability.share.id)
      expect((await reachable()).link).toBe(false)
      expect(ended).toEqual([context.documentId])
      expect(await audited(context)).toEqual([
        {
          action: 'document-share.revoked',
          subjectType: 'document-share',
          subjectId: capability.share.id
        }
      ])
    } finally {
      await context.runtime.close()
    }
  })

  test('lists documents by search and filter, and reports by where they stand', async () => {
    const { context, documents, reportsAdmin, fileReport } = await seed()
    try {
      await fileReport('guest-0123456789abcdef')
      await fileReport('guest-fedcba9876543210')
      const listed = await documents.list({ search: 'home', filter: 'reported' })
      expect(listed.documents.map((document) => [document.name, document.openReports])).toEqual([
        ['Homepage', 2]
      ])
      expect(listed.counts).toEqual({ all: 1, reported: 1, disabled: 0 })
      expect((await documents.list({ search: 'nothing-like-it' })).total).toBe(0)

      const open = await reportsAdmin.list()
      expect(open.reports).toHaveLength(2)
      expect(open.reports[0]?.document.name).toBe('Homepage')
      expect(open.reports[0]?.share?.revoked).toBe(false)

      const [first] = open.reports
      if (!first) throw new Error('Expected a report')
      await reportsAdmin.resolve(ADMIN, first.id, 'dismissed')
      const after = await reportsAdmin.list({ filter: 'all' })
      expect(after.counts).toEqual({ open: 1, actioned: 0, dismissed: 1, all: 2 })
      expect(await audited(context)).toEqual([
        { action: 'document-report.dismissed', subjectType: 'document-report', subjectId: first.id }
      ])
    } finally {
      await context.runtime.close()
    }
  })
})
