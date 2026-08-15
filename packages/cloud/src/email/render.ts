import type { DocumentInvitationMessage } from '#cloud/server/invitations'
import { render } from '@vue-email/render'

import { DocumentInvitationEmail } from './templates/document-invitation'

export type RenderedInvitationEmail = {
  subject: string
  html: string
  text: string
}

export async function renderDocumentInvitationEmail(
  message: DocumentInvitationMessage
): Promise<RenderedInvitationEmail> {
  const permissionLabel = message.permission === 'edit' ? 'edit' : 'view'
  const props = {
    inviterName: message.inviterName,
    documentName: message.documentName,
    permissionLabel,
    expiresAt: new Date(message.expiresAt).toUTCString(),
    acceptanceURL: message.acceptanceURL
  }
  const [html, text] = await Promise.all([
    render(DocumentInvitationEmail, props),
    render(DocumentInvitationEmail, props, { plainText: true })
  ])
  return {
    subject: `${message.inviterName} invited you to ${permissionLabel} ${message.documentName}`,
    html,
    text
  }
}
