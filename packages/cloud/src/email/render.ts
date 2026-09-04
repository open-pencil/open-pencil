import { render } from '@vue-email/render'

import { DocumentInvitationEmail } from './templates/document-invitation'
import { EnrollmentEmail } from './templates/enrollment'
import type {
  AdminEnrollmentNotificationPayload,
  AuthenticationEmailPayload,
  DocumentInvitationEmailPayload,
  EnrollmentEmailPayload,
  RenderedTransactionalEmail,
  TransactionalEmailKind,
  TransactionalEmailPayloadByKind
} from './types'

async function rendered(
  component: Parameters<typeof render>[0],
  props: Record<string, string>,
  subject: string
): Promise<RenderedTransactionalEmail> {
  const [html, text] = await Promise.all([
    render(component, props),
    render(component, props, { plainText: true })
  ])
  return { subject, html, text }
}

async function renderDocumentInvitation(payload: DocumentInvitationEmailPayload) {
  const permissionLabel = payload.permission === 'edit' ? 'edit' : 'view'
  return rendered(
    DocumentInvitationEmail,
    {
      inviterName: payload.inviterName,
      documentName: payload.documentName,
      permissionLabel,
      expiresAt: new Date(payload.expiresAt).toUTCString(),
      acceptanceURL: payload.acceptanceURL
    },
    `${payload.inviterName} invited you to ${permissionLabel} ${payload.documentName}`
  )
}

type EnrollmentMessageKind = Exclude<
  TransactionalEmailKind,
  | 'document-invitation'
  | 'admin-enrollment-notification'
  | 'email-verification'
  | 'password-reset'
  | 'password-changed'
>

type EnrollmentCopy = {
  subject: string
  heading: string
  preview: string
  message: string
  actionLabel: string
}

const ENROLLMENT_COPY: Record<EnrollmentMessageKind, Omit<EnrollmentCopy, 'message'>> = {
  'enrollment-requested': {
    subject: 'We received your OpenPencil Cloud request',
    heading: 'Request received',
    preview: 'Your OpenPencil Cloud access request is awaiting review.',
    actionLabel: 'Open OpenPencil Cloud'
  },
  'enrollment-approved': {
    subject: 'Your OpenPencil Cloud access is ready',
    heading: 'Access approved',
    preview: 'You can now sign in to OpenPencil Cloud.',
    actionLabel: 'Sign in'
  },
  'enrollment-rejected': {
    subject: 'Your OpenPencil Cloud request was reviewed',
    heading: 'Request reviewed',
    preview: 'Your current access request was not approved.',
    actionLabel: 'Request access again'
  },
  'enrollment-revoked': {
    subject: 'Your OpenPencil Cloud access has changed',
    heading: 'Access changed',
    preview: 'Your OpenPencil Cloud access is no longer active.',
    actionLabel: 'Open OpenPencil'
  }
}

function enrollmentCopy(kind: EnrollmentMessageKind, name: string): EnrollmentCopy {
  const copy = ENROLLMENT_COPY[kind]
  const messages: Record<EnrollmentMessageKind, string> = {
    'enrollment-requested': `Hi ${name}, your request is awaiting manual review.`,
    'enrollment-approved': `Hi ${name}, your access request was approved.`,
    'enrollment-rejected': `Hi ${name}, your current access request was not approved.`,
    'enrollment-revoked': `Hi ${name}, your Cloud access is no longer active.`
  }
  return { ...copy, message: messages[kind] }
}

async function renderEnrollment(
  kind: Exclude<
    TransactionalEmailKind,
    | 'document-invitation'
    | 'admin-enrollment-notification'
    | 'email-verification'
    | 'password-reset'
    | 'password-changed'
  >,
  payload: EnrollmentEmailPayload
) {
  const copy = enrollmentCopy(kind, payload.name)
  return rendered(EnrollmentEmail, { ...copy, actionURL: payload.actionURL }, copy.subject)
}

async function renderAdminNotification(payload: AdminEnrollmentNotificationPayload) {
  return rendered(
    EnrollmentEmail,
    {
      heading: 'New Cloud access request',
      preview: `${payload.requesterEmail} requested OpenPencil Cloud access.`,
      message: `${payload.requesterName} (${payload.requesterEmail}) requested access. ${payload.reason}`,
      actionLabel: 'Review request',
      actionURL: payload.actionURL
    },
    'New OpenPencil Cloud access request'
  )
}

async function renderAuthentication(
  kind: 'email-verification' | 'password-reset' | 'password-changed',
  payload: AuthenticationEmailPayload
) {
  const copy = {
    'email-verification': {
      subject: 'Verify your OpenPencil Cloud email',
      heading: 'Verify your email',
      preview: 'Verify your email address to continue to OpenPencil Cloud.',
      message: `Hi ${payload.name}, verify your email address to continue.`,
      actionLabel: 'Verify email'
    },
    'password-reset': {
      subject: 'Reset your OpenPencil Cloud password',
      heading: 'Reset your password',
      preview: 'Use this secure link to choose a new password.',
      message: `Hi ${payload.name}, use the link below to choose a new password.`,
      actionLabel: 'Reset password'
    },
    'password-changed': {
      subject: 'Your OpenPencil Cloud password changed',
      heading: 'Password changed',
      preview: 'Your OpenPencil Cloud password was changed.',
      message: `Hi ${payload.name}, your password was changed. If this was not you, contact your administrator.`,
      actionLabel: 'Open OpenPencil Cloud'
    }
  }[kind]
  return rendered(EnrollmentEmail, { ...copy, actionURL: payload.actionURL ?? '#' }, copy.subject)
}

export async function renderTransactionalEmail<Kind extends TransactionalEmailKind>(
  kind: Kind,
  payload: TransactionalEmailPayloadByKind[Kind]
): Promise<RenderedTransactionalEmail> {
  if (kind === 'document-invitation') {
    return renderDocumentInvitation(payload as DocumentInvitationEmailPayload)
  }
  if (kind === 'admin-enrollment-notification') {
    return renderAdminNotification(payload as AdminEnrollmentNotificationPayload)
  }
  if (kind === 'email-verification' || kind === 'password-reset' || kind === 'password-changed') {
    return renderAuthentication(kind, payload as AuthenticationEmailPayload)
  }
  return renderEnrollment(kind, payload as EnrollmentEmailPayload)
}
