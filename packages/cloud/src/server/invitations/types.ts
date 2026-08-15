import type { DocumentPermission } from '#cloud/contract'

export type DocumentInvitationMessage = {
  deliveryId: string
  recipientEmail: string
  inviterName: string
  documentName: string
  permission: DocumentPermission
  expiresAt: string
  acceptanceURL: string
}

export type InvitationDelivery = {
  sendDocumentInvitation(message: DocumentInvitationMessage): Promise<void>
}

export const noOpInvitationDelivery: InvitationDelivery = {
  async sendDocumentInvitation() {
    return undefined
  }
}
