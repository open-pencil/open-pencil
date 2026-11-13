import type { DocumentPermission } from '#cloud/contract'
import type { EmailLocale } from '#cloud/email'
import type { CloudDatabase } from '#cloud/server/db'
import type { Transaction } from 'kysely'

export type DocumentInvitationMessage = {
  deliveryId: string
  recipientEmail: string
  /** The language the invitation is written in. */
  locale: EmailLocale
  /** Null when the inviter's account is gone, so the email says someone invited you. */
  inviterName: string | null
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
