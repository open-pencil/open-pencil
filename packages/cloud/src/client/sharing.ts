import {
  acceptedInvitationSchema,
  createInvitationContinuationSchema,
  documentDownloadSchema,
  documentGrantSchema,
  documentInvitationSchema,
  documentShareSchema,
  invitationContinuationSchema,
  invitationPreviewSchema,
  resolvedDocumentShareSchema,
  type AcceptDocumentInvitationInput,
  type CollaborationTicket,
  type CreateInvitationContinuationInput,
  type InvitationContinuation,
  type CreateDocumentInvitationInput,
  type CreateDocumentShareInput,
  type DocumentGrant,
  type DocumentInvitation,
  type DocumentShare,
  type InvitationPreview,
  type PutDocumentGrantInput,
  type ResolveDocumentShareInput,
  fileDocumentReportResponseSchema,
  type FileDocumentReportInput,
  type UpdateDocumentShareInput,
  type AcceptedInvitation
} from '#cloud/contract'
import type { CloudAPI, PublicCloudAPI } from '#cloud/server/api'
import type { hc } from 'hono/client'
import * as v from 'valibot'

import { parseResponse, responseBody, type CloudClientDiagnostic } from './response'
import { collaborationTicketResponseSchema } from './schema'

const sharesResponseSchema = v.object({ shares: v.array(documentShareSchema) })
const shareResponseSchema = v.object({ share: documentShareSchema })
const shareCapabilityResponseSchema = v.object({
  share: documentShareSchema,
  secret: v.string(),
  path: v.string()
})
const grantsResponseSchema = v.object({ grants: v.array(documentGrantSchema) })
const grantResponseSchema = v.object({ grant: documentGrantSchema })
const acceptedResponseSchema = v.object({ accepted: acceptedInvitationSchema })
const invitationPreviewResponseSchema = v.object({ invitation: invitationPreviewSchema })
const invitationsResponseSchema = v.object({ invitations: v.array(documentInvitationSchema) })
const invitationCapabilityResponseSchema = v.object({
  invitation: documentInvitationSchema,
  token: v.string()
})
const resolvedShareResponseSchema = v.object({ resolution: resolvedDocumentShareSchema })
const sharedDocumentResponseSchema = v.object({
  resolution: resolvedDocumentShareSchema,
  document: documentDownloadSchema
})

/** Sharing a document: its links, grants, and invitations, and opening what someone shared. */
export function createSharingRequests(
  client: ReturnType<typeof hc<CloudAPI>>,
  publicClient: ReturnType<typeof hc<PublicCloudAPI>>,
  onDiagnostic?: CloudClientDiagnostic
) {
  return {
    async listDocumentShares(documentId: string): Promise<DocumentShare[]> {
      const response = await parseResponse(
        client.documents[':documentId'].shares.$get({ param: { documentId } }),
        sharesResponseSchema,
        onDiagnostic
      )
      return response.shares
    },
    async createDocumentShare(documentId: string, input: CreateDocumentShareInput) {
      return parseResponse(
        client.documents[':documentId'].shares.$post({
          param: { documentId },
          json: input
        }),
        shareCapabilityResponseSchema,
        onDiagnostic
      )
    },
    async updateDocumentShare(
      documentId: string,
      shareId: string,
      input: UpdateDocumentShareInput
    ): Promise<DocumentShare> {
      const response = await parseResponse(
        client.documents[':documentId'].shares[':shareId'].$patch({
          param: { documentId, shareId },
          json: input
        }),
        shareResponseSchema,
        onDiagnostic
      )
      return response.share
    },
    async rotateDocumentShare(documentId: string, shareId: string) {
      return parseResponse(
        client.documents[':documentId'].shares[':shareId'].rotate.$post({
          param: { documentId, shareId }
        }),
        shareCapabilityResponseSchema,
        onDiagnostic
      )
    },
    async revokeDocumentShare(documentId: string, shareId: string): Promise<void> {
      await responseBody(
        await client.documents[':documentId'].shares[':shareId'].$delete({
          param: { documentId, shareId }
        }),
        onDiagnostic
      )
    },
    async listDocumentGrants(documentId: string): Promise<DocumentGrant[]> {
      const response = await parseResponse(
        client.documents[':documentId'].grants.$get({ param: { documentId } }),
        grantsResponseSchema,
        onDiagnostic
      )
      return response.grants
    },
    async putDocumentGrant(
      documentId: string,
      userId: string,
      input: PutDocumentGrantInput
    ): Promise<DocumentGrant> {
      const response = await parseResponse(
        client.documents[':documentId'].grants[':userId'].$put({
          param: { documentId, userId },
          json: input
        }),
        grantResponseSchema,
        onDiagnostic
      )
      return response.grant
    },
    async revokeDocumentGrant(documentId: string, userId: string): Promise<void> {
      await responseBody(
        await client.documents[':documentId'].grants[':userId'].$delete({
          param: { documentId, userId }
        }),
        onDiagnostic
      )
    },
    async listDocumentInvitations(documentId: string): Promise<DocumentInvitation[]> {
      const response = await parseResponse(
        client.documents[':documentId'].invitations.$get({ param: { documentId } }),
        invitationsResponseSchema,
        onDiagnostic
      )
      return response.invitations
    },
    async createDocumentInvitation(documentId: string, input: CreateDocumentInvitationInput) {
      return parseResponse(
        client.documents[':documentId'].invitations.$post({
          param: { documentId },
          json: input
        }),
        invitationCapabilityResponseSchema,
        onDiagnostic
      )
    },
    async createInvitationContinuation(
      input: CreateInvitationContinuationInput
    ): Promise<InvitationContinuation> {
      return parseResponse(
        publicClient.invitations.continuations.$post({ json: input }),
        invitationContinuationSchema,
        onDiagnostic
      )
    },
    async consumeInvitationContinuation(id: string): Promise<CreateInvitationContinuationInput> {
      return parseResponse(
        publicClient.invitations.continuations[':continuationId'].consume.$post({
          param: { continuationId: id }
        }),
        createInvitationContinuationSchema,
        onDiagnostic
      )
    },
    async previewInvitation(
      invitationId: string,
      input: AcceptDocumentInvitationInput
    ): Promise<InvitationPreview> {
      const response = await parseResponse(
        publicClient.invitations[':invitationId'].preview.$post({
          param: { invitationId },
          json: input
        }),
        invitationPreviewResponseSchema,
        onDiagnostic
      )
      return response.invitation
    },
    /** Accepts a document or workspace invitation, and says which it was. */
    async acceptInvitation(
      invitationId: string,
      input: AcceptDocumentInvitationInput
    ): Promise<AcceptedInvitation> {
      const response = await parseResponse(
        client.invitations[':invitationId'].accept.$post({
          param: { invitationId },
          json: input
        }),
        acceptedResponseSchema,
        onDiagnostic
      )
      return response.accepted
    },
    async revokeDocumentInvitation(documentId: string, invitationId: string): Promise<void> {
      await responseBody(
        await client.documents[':documentId'].invitations[':invitationId'].$delete({
          param: { documentId, invitationId }
        }),
        onDiagnostic
      )
    },
    /** Reports the document a share link opens to the server's administrators. */
    async fileDocumentReport(shareId: string, input: FileDocumentReportInput): Promise<void> {
      await parseResponse(
        publicClient.shares[':shareId'].reports.$post({ param: { shareId }, json: input }),
        fileDocumentReportResponseSchema,
        onDiagnostic
      )
    },
    async resolveDocumentShare(shareId: string, input: ResolveDocumentShareInput) {
      const response = await parseResponse(
        publicClient.shares[':shareId'].resolve.$post({
          param: { shareId },
          json: input
        }),
        resolvedShareResponseSchema,
        onDiagnostic
      )
      return response.resolution
    },
    async getSharedDocument(shareId: string, input: ResolveDocumentShareInput) {
      return parseResponse(
        publicClient.shares[':shareId'].document.$post({
          param: { shareId },
          json: input
        }),
        sharedDocumentResponseSchema,
        onDiagnostic
      )
    },
    async getSharedCollaborationTicket(
      shareId: string,
      input: ResolveDocumentShareInput
    ): Promise<CollaborationTicket> {
      const response = await parseResponse(
        publicClient.shares[':shareId']['collaboration-ticket'].$post({
          param: { shareId },
          json: input
        }),
        collaborationTicketResponseSchema,
        onDiagnostic
      )
      return response.ticket
    }
  }
}
