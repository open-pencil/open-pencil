import type {
  AcceptDocumentInvitationInput,
  AcceptedInvitation,
  CollaborationTicket,
  CreateDocumentInvitationInput,
  CreateDocumentShareInput,
  CreateInvitationContinuationInput,
  DocumentGrant,
  DocumentInvitation,
  DocumentShare,
  FileDocumentReportInput,
  InvitationContinuation,
  InvitationPreview,
  PutDocumentGrantInput,
  ResolveDocumentShareInput,
  UpdateDocumentShareInput
} from '#cloud/contract'

import type { CloudContractClient } from './contract'

/** Sharing a document: its links, grants, and invitations, and opening what someone shared. */
export function createSharingRequests(
  contract: CloudContractClient['sharing'],
  publicContract: CloudContractClient['publicSharing']
) {
  return {
    async listDocumentShares(documentId: string): Promise<DocumentShare[]> {
      return (await contract.listShares({ params: { documentId } })).shares
    },
    createDocumentShare(documentId: string, input: CreateDocumentShareInput) {
      return contract.createShare({ params: { documentId }, body: input })
    },
    async updateDocumentShare(
      documentId: string,
      shareId: string,
      input: UpdateDocumentShareInput
    ): Promise<DocumentShare> {
      return (await contract.updateShare({ params: { documentId, shareId }, body: input })).share
    },
    rotateDocumentShare(documentId: string, shareId: string) {
      return contract.rotateShare({ params: { documentId, shareId } })
    },
    async revokeDocumentShare(documentId: string, shareId: string): Promise<void> {
      await contract.revokeShare({ params: { documentId, shareId } })
    },
    async listDocumentGrants(documentId: string): Promise<DocumentGrant[]> {
      return (await contract.listGrants({ params: { documentId } })).grants
    },
    async putDocumentGrant(
      documentId: string,
      userId: string,
      input: PutDocumentGrantInput
    ): Promise<DocumentGrant> {
      return (await contract.putGrant({ params: { documentId, userId }, body: input })).grant
    },
    async revokeDocumentGrant(documentId: string, userId: string): Promise<void> {
      await contract.revokeGrant({ params: { documentId, userId } })
    },
    async listDocumentInvitations(documentId: string): Promise<DocumentInvitation[]> {
      return (await contract.listInvitations({ params: { documentId } })).invitations
    },
    createDocumentInvitation(documentId: string, input: CreateDocumentInvitationInput) {
      return contract.createInvitation({ params: { documentId }, body: input })
    },
    createInvitationContinuation(
      input: CreateInvitationContinuationInput
    ): Promise<InvitationContinuation> {
      return publicContract.createContinuation({ body: input })
    },
    consumeInvitationContinuation(id: string): Promise<CreateInvitationContinuationInput> {
      return publicContract.consumeContinuation({ params: { continuationId: id } })
    },
    async previewInvitation(
      invitationId: string,
      input: AcceptDocumentInvitationInput
    ): Promise<InvitationPreview> {
      return (await publicContract.previewInvitation({ params: { invitationId }, body: input }))
        .invitation
    },
    /** Accepts a document or workspace invitation, and says which it was. */
    async acceptInvitation(
      invitationId: string,
      input: AcceptDocumentInvitationInput
    ): Promise<AcceptedInvitation> {
      return (await contract.acceptInvitation({ params: { invitationId }, body: input })).accepted
    },
    async revokeDocumentInvitation(documentId: string, invitationId: string): Promise<void> {
      await contract.revokeInvitation({ params: { documentId, invitationId } })
    },
    /** Reports the document a share link opens to the server's administrators. */
    async fileDocumentReport(shareId: string, input: FileDocumentReportInput): Promise<void> {
      await publicContract.fileReport({ params: { shareId }, body: input })
    },
    async resolveDocumentShare(shareId: string, input: ResolveDocumentShareInput) {
      return (await publicContract.resolveShare({ params: { shareId }, body: input })).resolution
    },
    getSharedDocument(shareId: string, input: ResolveDocumentShareInput) {
      return publicContract.document({ params: { shareId }, body: input })
    },
    async getSharedCollaborationTicket(
      shareId: string,
      input: ResolveDocumentShareInput
    ): Promise<CollaborationTicket> {
      return (await publicContract.collaborationTicket({ params: { shareId }, body: input })).ticket
    }
  }
}
