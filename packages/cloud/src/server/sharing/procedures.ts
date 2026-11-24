import { publicSharingContract, sharingContract } from '#cloud/contract'
import { acceptedLocale } from '#cloud/email'
import type { CloudActor, CloudSessionResolver } from '#cloud/server/auth'
import type { CollaborationTicketService } from '#cloud/server/collaboration/service'
import type { DocumentService } from '#cloud/server/documents'
import { DocumentReportLimitError, type DocumentReportService } from '#cloud/server/reports/service'
import { sharingErrors } from '#cloud/server/sharing/http'
import { implement } from '@orpc/server'

import { shareActor } from './actor'
import type { DocumentSharingService } from './service'

/** Sharing a document, as the contract describes it, for the signed-in actor. */
export function createSharingProcedures(
  sharing: DocumentSharingService,
  collaboration: CollaborationTicketService
) {
  const routes = implement(sharingContract).$context<{ actor: CloudActor }>().use(sharingErrors)
  return routes.router({
    userProfile: routes.userProfile.handler(async ({ context, input }) => ({
      user: await sharing.userProfile(
        context.actor.userId,
        input.params.documentId,
        input.params.userId
      )
    })),
    listShares: routes.listShares.handler(async ({ context, input }) => ({
      shares: await sharing.listShares(context.actor.userId, input.params.documentId)
    })),
    createShare: routes.createShare.handler(({ context, input }) =>
      sharing.createShare(context.actor.userId, input.params.documentId, input.body)
    ),
    updateShare: routes.updateShare.handler(async ({ context, input }) => ({
      share: await sharing.updateShare(
        context.actor.userId,
        input.params.documentId,
        input.params.shareId,
        input.body
      )
    })),
    rotateShare: routes.rotateShare.handler(({ context, input }) =>
      sharing.rotateShare(context.actor.userId, input.params.documentId, input.params.shareId)
    ),
    revokeShare: routes.revokeShare.handler(async ({ context, input }) => {
      await sharing.revokeShare(context.actor.userId, input.params.documentId, input.params.shareId)
    }),
    listGrants: routes.listGrants.handler(async ({ context, input }) => ({
      grants: await sharing.listGrants(context.actor.userId, input.params.documentId)
    })),
    putGrant: routes.putGrant.handler(async ({ context, input }) => ({
      grant: await sharing.putGrant(
        context.actor.userId,
        input.params.documentId,
        input.params.userId,
        input.body
      )
    })),
    revokeGrant: routes.revokeGrant.handler(async ({ context, input }) => {
      await sharing.revokeGrant(context.actor.userId, input.params.documentId, input.params.userId)
    }),
    listInvitations: routes.listInvitations.handler(async ({ context, input }) => ({
      invitations: await sharing.listInvitations(context.actor.userId, input.params.documentId)
    })),
    createInvitation: routes.createInvitation.handler(({ context, input }) =>
      sharing.createInvitation(context.actor.userId, input.params.documentId, input.body)
    ),
    revokeInvitation: routes.revokeInvitation.handler(async ({ context, input }) => {
      await sharing.revokeInvitation(
        context.actor.userId,
        input.params.documentId,
        input.params.invitationId
      )
    }),
    acceptInvitation: routes.acceptInvitation.handler(async ({ context, input }) => ({
      accepted: await sharing.acceptInvitation(context.actor, input.params.invitationId, input.body)
    })),
    collaborationTicket: routes.collaborationTicket.handler(async ({ context, input }) => ({
      ticket: await collaboration.issueUserTicket(context.actor, input.params.documentId)
    }))
  })
}

/** What a public route knows of its request: the request, and who to name in error reports. */
export type PublicProcedureContext = {
  request: Request
  /** Names the signed-in caller in error reports, as routes that require one do. */
  identify(actor: CloudActor): void
}

/** What anyone may do with a link or an invitation, as the contract describes it. */
export function createPublicSharingProcedures(services: {
  sharing: DocumentSharingService
  documents: DocumentService
  collaboration: Pick<CollaborationTicketService, 'issueShareTicket'>
  reports: DocumentReportService
  resolveSession?: CloudSessionResolver
}) {
  const { sharing, documents, collaboration, reports, resolveSession } = services
  const routes = implement(publicSharingContract)
    .$context<PublicProcedureContext>()
    .use(sharingErrors)
  const follower = (request: Request) => shareActor(request, resolveSession)
  return routes.router({
    createContinuation: routes.createContinuation.handler(({ input }) =>
      sharing.createInvitationContinuation(input.body)
    ),
    consumeContinuation: routes.consumeContinuation.handler(({ input }) =>
      sharing.consumeInvitationContinuation(input.params.continuationId)
    ),
    previewInvitation: routes.previewInvitation.handler(async ({ input }) => ({
      invitation: await sharing.previewInvitation(input.params.invitationId, input.body)
    })),
    resolveShare: routes.resolveShare.handler(async ({ context, input }) => ({
      resolution: await sharing.resolveShare(
        input.params.shareId,
        input.body,
        await follower(context.request)
      )
    })),
    document: routes.document.handler(async ({ context, input }) => {
      const resolution = await sharing.resolveShare(
        input.params.shareId,
        input.body,
        await follower(context.request)
      )
      return { resolution, document: await documents.downloadShared(resolution.documentId) }
    }),
    imageLinks: routes.imageLinks.handler(async ({ context, input }) => {
      const { checksums, ...share } = input.body
      const resolution = await sharing.resolveShare(
        input.params.shareId,
        share,
        await follower(context.request)
      )
      return documents.imageLinksShared(resolution.documentId, checksums)
    }),
    collaborationTicket: routes.collaborationTicket.handler(async ({ context, input }) => {
      const actor = await follower(context.request)
      if (actor) context.identify(actor)
      return {
        ticket: await collaboration.issueShareTicket(input.params.shareId, input.body, actor)
      }
    }),
    fileReport: routes.fileReport.handler(async ({ context, input, errors }) => {
      try {
        await reports.file(
          input.params.shareId,
          input.body,
          await follower(context.request),
          acceptedLocale(context.request.headers.get('accept-language') ?? undefined)
        )
      } catch (error) {
        if (error instanceof DocumentReportLimitError) throw errors.rate_limited({ cause: error })
        throw error
      }
      return { received: true as const }
    })
  })
}
