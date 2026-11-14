import {
  documentPermissionSchema,
  documentReportReasonSchema,
  workspaceRoleSchema
} from '#cloud/contract'
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
  | 'document-report'
  | 'storage-limit-reached'
  | 'document-blocked'
  | 'document-restored'

const documentInvitationEmailPayloadSchema = v.object({
  /** Null when the inviter's account is gone, so the email says someone invited you. */
  inviterName: v.nullable(v.string()),
  documentName: v.string(),
  permission: documentPermissionSchema,
  expiresAt: v.string(),
  acceptanceURL: v.string()
})

const workspaceInvitationEmailPayloadSchema = v.object({
  /** Null when the inviter's account is gone, so the email says someone invited you. */
  inviterName: v.nullable(v.string()),
  workspaceName: v.string(),
  role: workspaceRoleSchema,
  expiresAt: v.string(),
  acceptanceURL: v.string()
})

const enrollmentEmailPayloadSchema = v.object({
  /** Null when the request named no one, so the email greets no one by name. */
  name: v.nullable(v.string()),
  actionURL: v.string()
})

const adminEnrollmentNotificationPayloadSchema = v.object({
  requesterEmail: v.string(),
  requesterName: v.string(),
  reason: v.string(),
  actionURL: v.string()
})

const documentReportPayloadSchema = v.object({
  documentName: v.string(),
  reason: documentReportReasonSchema,
  description: v.string(),
  actionURL: v.string()
})

const storageLimitReachedPayloadSchema = v.object({
  name: v.string(),
  usedBytes: v.number(),
  limitBytes: v.number(),
  /** Whether the server sells plans, so the account can get more storage rather than only free it. */
  upgradable: v.boolean(),
  actionURL: v.string()
})

/** To a workspace's owner: an administrator took one of its documents down. */
const documentBlockedPayloadSchema = v.object({
  /** The owner's name, or null when the account has none. */
  name: v.nullable(v.string()),
  documentName: v.string(),
  /** Why, as the administrator wrote it, or null when they gave no reason. */
  reason: v.nullable(v.string()),
  /** Where to write to contest it: the deployment's abuse address, or null without one. */
  contactEmail: v.nullable(v.pipe(v.string(), v.email())),
  actionURL: v.string()
})

/** To a workspace's owner: a document taken down is back. */
const documentRestoredPayloadSchema = v.object({
  name: v.nullable(v.string()),
  documentName: v.string(),
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
  content('two-step-changed', twoStepChangedPayloadSchema),
  content('document-report', documentReportPayloadSchema),
  content('storage-limit-reached', storageLimitReachedPayloadSchema),
  content('document-blocked', documentBlockedPayloadSchema),
  content('document-restored', documentRestoredPayloadSchema)
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
export type DocumentReportPayload = v.InferOutput<typeof documentReportPayloadSchema>
export type StorageLimitReachedPayload = v.InferOutput<typeof storageLimitReachedPayloadSchema>
export type DocumentBlockedPayload = v.InferOutput<typeof documentBlockedPayloadSchema>
export type DocumentRestoredPayload = v.InferOutput<typeof documentRestoredPayloadSchema>
