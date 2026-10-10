import { documentPermissionSchema } from '#cloud/contract'
import * as v from 'valibot'

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

const documentInvitationEmailPayloadSchema = v.object({
  inviterName: v.string(),
  documentName: v.string(),
  permission: documentPermissionSchema,
  expiresAt: v.string(),
  acceptanceURL: v.string()
})

const enrollmentEmailPayloadSchema = v.object({
  name: v.string(),
  actionURL: v.string()
})

const adminEnrollmentNotificationPayloadSchema = v.object({
  requesterEmail: v.string(),
  requesterName: v.string(),
  reason: v.string(),
  actionURL: v.string()
})

const authenticationEmailPayloadSchema = v.object({
  name: v.string(),
  actionURL: v.optional(v.string())
})

function content<const Kind extends TransactionalEmailKind, Payload extends v.GenericSchema>(
  kind: Kind,
  payload: Payload
) {
  return v.object({ kind: v.literal(kind), payload })
}

export const transactionalEmailContentSchema = v.variant('kind', [
  content('document-invitation', documentInvitationEmailPayloadSchema),
  content('enrollment-requested', enrollmentEmailPayloadSchema),
  content('admin-enrollment-notification', adminEnrollmentNotificationPayloadSchema),
  content('enrollment-approved', enrollmentEmailPayloadSchema),
  content('enrollment-rejected', enrollmentEmailPayloadSchema),
  content('enrollment-revoked', enrollmentEmailPayloadSchema),
  content('email-verification', authenticationEmailPayloadSchema),
  content('password-reset', authenticationEmailPayloadSchema),
  content('password-changed', authenticationEmailPayloadSchema)
])

/** A transactional email's kind with the payload that kind renders. */
export type TransactionalEmailContent = v.InferOutput<typeof transactionalEmailContentSchema>

export type DocumentInvitationEmailPayload = v.InferOutput<
  typeof documentInvitationEmailPayloadSchema
>
export type EnrollmentEmailPayload = v.InferOutput<typeof enrollmentEmailPayloadSchema>
export type AdminEnrollmentNotificationPayload = v.InferOutput<
  typeof adminEnrollmentNotificationPayloadSchema
>
export type AuthenticationEmailPayload = v.InferOutput<typeof authenticationEmailPayloadSchema>

export type TransactionalEmailPayloadByKind = {
  [Kind in TransactionalEmailKind]: Extract<TransactionalEmailContent, { kind: Kind }>['payload']
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
