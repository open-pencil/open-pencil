import { documentPermissionSchema, workspaceRoleSchema } from '#cloud/contract'
import * as v from 'valibot'

export type TransactionalEmailKind =
  | 'document-invitation'
  | 'workspace-invitation'
  | 'enrollment-requested'
  | 'admin-enrollment-notification'
  | 'enrollment-approved'
  | 'enrollment-rejected'
  | 'enrollment-revoked'
  | 'email-verification'
  | 'password-reset'
  | 'password-changed'
  | 'email-change-requested'
  | 'new-sign-in'
  | 'two-step-changed'

const documentInvitationEmailPayloadSchema = v.object({
  inviterName: v.string(),
  documentName: v.string(),
  permission: documentPermissionSchema,
  expiresAt: v.string(),
  acceptanceURL: v.string()
})

const workspaceInvitationEmailPayloadSchema = v.object({
  inviterName: v.string(),
  workspaceName: v.string(),
  role: workspaceRoleSchema,
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
  actionURL: v.optional(v.string()),
  /** What a verification link confirms: a new account, or a new address for one. */
  purpose: v.optional(v.picklist(['account', 'change']))
})

const emailChangeRequestedPayloadSchema = v.object({
  name: v.string(),
  newEmail: v.string(),
  actionURL: v.string()
})

const newSignInPayloadSchema = v.object({
  name: v.string(),
  signedInAt: v.string(),
  ipAddress: v.nullable(v.string()),
  browser: v.nullable(v.string()),
  system: v.nullable(v.string()),
  desktop: v.boolean(),
  actionURL: v.string()
})

/** What changed about how an account proves it is its owner's. */
export const twoStepChangeSchema = v.picklist([
  'authenticator-on',
  'authenticator-off',
  'passkey-added',
  'passkey-removed',
  'reset-by-administrator'
])

const twoStepChangedPayloadSchema = v.object({
  name: v.string(),
  change: twoStepChangeSchema,
  actionURL: v.string()
})

function content<const Kind extends TransactionalEmailKind, Payload extends v.GenericSchema>(
  kind: Kind,
  payload: Payload
) {
  return v.object({ kind: v.literal(kind), payload })
}

export const transactionalEmailContentSchema = v.variant('kind', [
  content('document-invitation', documentInvitationEmailPayloadSchema),
  content('workspace-invitation', workspaceInvitationEmailPayloadSchema),
  content('enrollment-requested', enrollmentEmailPayloadSchema),
  content('admin-enrollment-notification', adminEnrollmentNotificationPayloadSchema),
  content('enrollment-approved', enrollmentEmailPayloadSchema),
  content('enrollment-rejected', enrollmentEmailPayloadSchema),
  content('enrollment-revoked', enrollmentEmailPayloadSchema),
  content('email-verification', authenticationEmailPayloadSchema),
  content('password-reset', authenticationEmailPayloadSchema),
  content('password-changed', authenticationEmailPayloadSchema),
  content('email-change-requested', emailChangeRequestedPayloadSchema),
  content('new-sign-in', newSignInPayloadSchema),
  content('two-step-changed', twoStepChangedPayloadSchema)
])

/** A transactional email's kind with the payload that kind renders. */
export type TransactionalEmailContent = v.InferOutput<typeof transactionalEmailContentSchema>

export type DocumentInvitationEmailPayload = v.InferOutput<
  typeof documentInvitationEmailPayloadSchema
>
export type WorkspaceInvitationEmailPayload = v.InferOutput<
  typeof workspaceInvitationEmailPayloadSchema
>
export type EnrollmentEmailPayload = v.InferOutput<typeof enrollmentEmailPayloadSchema>
export type AdminEnrollmentNotificationPayload = v.InferOutput<
  typeof adminEnrollmentNotificationPayloadSchema
>
export type AuthenticationEmailPayload = v.InferOutput<typeof authenticationEmailPayloadSchema>
export type EmailChangeRequestedPayload = v.InferOutput<typeof emailChangeRequestedPayloadSchema>
export type NewSignInPayload = v.InferOutput<typeof newSignInPayloadSchema>
export type TwoStepChange = v.InferOutput<typeof twoStepChangeSchema>
export type TwoStepChangedPayload = v.InferOutput<typeof twoStepChangedPayloadSchema>

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
