import type { DocumentPermission } from '#cloud/contract'

export type TransactionalEmailKind =
  | 'document-invitation'
  | 'enrollment-requested'
  | 'admin-enrollment-notification'
  | 'enrollment-approved'
  | 'enrollment-rejected'
  | 'enrollment-revoked'
  | 'email-verification'
  | 'password-reset'
  | 'password-changed'

export type DocumentInvitationEmailPayload = {
  inviterName: string
  documentName: string
  permission: DocumentPermission
  expiresAt: string
  acceptanceURL: string
}

export type EnrollmentEmailPayload = {
  name: string
  actionURL: string
}

export type AdminEnrollmentNotificationPayload = {
  requesterEmail: string
  requesterName: string
  reason: string
  actionURL: string
}

export type AuthenticationEmailPayload = {
  name: string
  actionURL?: string
}

export type TransactionalEmailPayloadByKind = {
  'document-invitation': DocumentInvitationEmailPayload
  'enrollment-requested': EnrollmentEmailPayload
  'admin-enrollment-notification': AdminEnrollmentNotificationPayload
  'enrollment-approved': EnrollmentEmailPayload
  'enrollment-rejected': EnrollmentEmailPayload
  'enrollment-revoked': EnrollmentEmailPayload
  'email-verification': AuthenticationEmailPayload
  'password-reset': AuthenticationEmailPayload
  'password-changed': AuthenticationEmailPayload
}

export type TransactionalEmailMessage<
  Kind extends TransactionalEmailKind = TransactionalEmailKind
> = {
  id: string
  kind: Kind
  recipientEmail: string
  payload: TransactionalEmailPayloadByKind[Kind]
}

export type RenderedTransactionalEmail = {
  subject: string
  html: string
  text: string
}
