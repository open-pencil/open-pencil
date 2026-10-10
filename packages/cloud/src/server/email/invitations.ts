import type { CloudDatabase } from '#cloud/server/db'
import type { DocumentInvitationMessage, InvitationOutbox } from '#cloud/server/invitations'
import type { Transaction } from 'kysely'

import type { TransactionalEmailService } from './types'

export function createInvitationOutbox(email: TransactionalEmailService): InvitationOutbox {
  return {
    enqueueDocumentInvitation(
      message: DocumentInvitationMessage,
      transaction?: Transaction<CloudDatabase>
    ): Promise<string> {
      return email.enqueue(
        {
          idempotencyKey: `document-invitation/${message.deliveryId}`,
          kind: 'document-invitation',
          recipientEmail: message.recipientEmail,
          payload: {
            inviterName: message.inviterName,
            documentName: message.documentName,
            permission: message.permission,
            expiresAt: message.expiresAt,
            acceptanceURL: message.acceptanceURL
          }
        },
        transaction
      )
    }
  }
}
