import { describe, expect, test } from 'bun:test'

import { seedSharing } from '#cloud-tests/helpers/sharing'
import { createAdminDocumentService, createAdminReportService } from '#cloud/admin'
import {
  createCollaborationTicketService,
  createDefaultCloudPolicy,
  createDocumentReportService,
  createTransactionalEmailService,
  DocumentNotFoundError,
  DocumentShareInvalidError,
  relayDocumentLookups,
  resolveDocumentAccess
} from '#cloud/server'
import { listDocuments } from '#cloud/server/documents/repository'
import { decryptTransactionalEmailPayload } from '#cloud/server/email'

const ADMIN = 'admin-user'

async function seed() {
  const context = await seedSharing()
  const ended: string[] = []
  const documents = createAdminDocumentService(context.runtime.database, {
    closeRooms: (documentId) => ended.push(documentId)
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

      const invited = await context.sharing.createInvitation('owner', context.documentId, {
        email: 'later@example.com',
        permission: 'view'
      })
      const invitation = { token: invited.token }
      const recipient = { userId: 'later-user', name: 'Later', email: 'later@example.com' }

      await documents.disable(ADMIN, context.documentId, 'Phishing')
      expect(await reachable()).toEqual({ owner: false, link: false, ticket: false, listed: false })
      // Its invitations name nothing meanwhile, and stay unused.
      await expect(
        context.sharing.previewInvitation(invited.invitation.id, invitation)
      ).rejects.toBeInstanceOf(DocumentShareInvalidError)
      await expect(
        context.sharing.acceptInvitation(recipient, invited.invitation.id, invitation)
      ).rejects.toBeInstanceOf(DocumentShareInvalidError)
      expect(ended).toEqual([context.documentId])
      // Its open report counts as acted on.
      expect(
        await context.runtime.database.selectFrom('documentReport').select('status').execute()
      ).toEqual([{ status: 'actioned' }])

      // The relay admits nobody, even with a ticket from before, and the room keeps its epoch.
      const relay = relayDocumentLookups(
        context.runtime.database,
        createDefaultCloudPolicy(),
        'self-hosted'
      )
      expect(await relay.maximumParticipants?.(context.documentId)).toBe(0)
      expect(await relay.currentRoomEpoch?.(context.documentId)).toBe(0)

      await documents.enable(ADMIN, context.documentId)
      expect(await reachable()).toEqual({ owner: true, link: true, ticket: true, listed: true })
      expect(await relay.maximumParticipants?.(context.documentId)).not.toBe(0)
      expect(
        await context.sharing.acceptInvitation(recipient, invited.invitation.id, invitation)
      ).toMatchObject({ kind: 'document' })
      expect(await audited(context)).toEqual([
        { action: 'document.disabled', subjectType: 'document', subjectId: context.documentId },
        { action: 'document.enabled', subjectType: 'document', subjectId: context.documentId }
      ])
    } finally {
      await context.runtime.close()
    }
  })

  test('revokes a link for good, leaving members’ rooms open', async () => {
    const { context, documents, capability, reachable, ended } = await seed()
    try {
      await documents.revokeShare(ADMIN, capability.share.id)
      expect(await reachable()).toEqual({ owner: true, link: false, ticket: true, listed: true })
      expect(ended).toEqual([])
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
      expect(listed.counts).toEqual({ all: 1, reported: 1, disabled: 0, purged: 0 })
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

  test('tells the workspace’s owner when a document is blocked, why, and when it is back', async () => {
    const context = await seedSharing()
    // The real outbox, in the block's own transaction, so a kind the table refuses fails here.
    const email = createTransactionalEmailService(context.runtime.database, {
      encryptionSecret: 'integration-test-secret-at-least-32-characters',
      from: 'cloud@example.com'
    })
    const documents = createAdminDocumentService(context.runtime.database, {
      email,
      publicURL: 'https://cloud.example.com',
      contactEmail: 'abuse@example.com'
    })
    try {
      const ownerId = crypto.randomUUID()
      await context.runtime.database
        .insertInto('user')
        .values({ id: ownerId, name: 'Owner', email: 'owner@example.com', emailVerified: true })
        .execute()
      await context.runtime.database
        .updateTable('workspace')
        .set({ ownerId })
        .where('ownerId', '=', 'owner')
        .execute()

      await documents.disable(ADMIN, context.documentId, 'Phishing')
      // Blocking it again tells nobody twice.
      await documents.disable(ADMIN, context.documentId, 'Phishing')
      await documents.enable(ADMIN, context.documentId)

      const queued = await context.runtime.database
        .selectFrom('transactionalEmail')
        .select(['id', 'kind', 'recipientEmailNormalized', 'payloadEncrypted'])
        .orderBy('createdAt')
        .execute()
      expect(
        queued.map(({ kind, recipientEmailNormalized }) => [kind, recipientEmailNormalized])
      ).toEqual([
        ['document-blocked', 'owner@example.com'],
        ['document-restored', 'owner@example.com']
      ])
      const [blocked] = queued
      if (!blocked?.payloadEncrypted) throw new Error('The block queued no email')
      // Read the sealed payload back as delivery would.
      const content = await decryptTransactionalEmailPayload(
        'integration-test-secret-at-least-32-characters',
        blocked.id,
        'document-blocked',
        blocked.payloadEncrypted
      )
      expect(content.payload).toMatchObject({
        name: 'Owner',
        documentName: 'Homepage',
        reason: 'Phishing',
        contactEmail: 'abuse@example.com',
        actionURL: 'https://cloud.example.com'
      })
    } finally {
      await context.runtime.close()
    }
  })
})
