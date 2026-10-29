import type { DocumentPermission } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import type { Transaction } from 'kysely'

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

export type InvitationOutbox = {
  enqueueDocumentInvitation(
    message: DocumentInvitationMessage,
    transaction?: Transaction<CloudDatabase>
  ): Promise<string>
}

export const noOpInvitationDelivery: InvitationDelivery = {
  async sendDocumentInvitation() {
    return undefined
  }
}
