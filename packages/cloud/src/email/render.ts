import { render } from '@vue-email/render'
import { compact } from 'es-toolkit'

import type {
  AdminEnrollmentNotificationPayload,
  AuthenticationEmailPayload,
  DocumentInvitationEmailPayload,
  EmailChangeRequestedPayload,
  EnrollmentEmailPayload,
  NewSignInPayload,
  RenderedTransactionalEmail,
  TransactionalEmailContent,
  TransactionalEmailKind,
  TwoStepChange,
  TwoStepChangedPayload,
  WorkspaceInvitationEmailPayload
} from './schema'
import { DocumentInvitationEmail } from './templates/document-invitation'
import { EnrollmentEmail } from './templates/enrollment'

async function rendered(
  component: Parameters<typeof render>[0],
  props: Record<string, string | undefined>,
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

const WORKSPACE_ROLE_LABELS = { admin: 'manage', editor: 'edit in', viewer: 'view' } as const

async function renderWorkspaceInvitation(payload: WorkspaceInvitationEmailPayload) {
  const action = WORKSPACE_ROLE_LABELS[payload.role]
  return rendered(
    EnrollmentEmail,
    {
      heading: `Join ${payload.workspaceName}`,
      preview: `${payload.inviterName} invited you to ${payload.workspaceName}`,
      message: `${payload.inviterName} invited you to ${action} the workspace “${payload.workspaceName}” on OpenPencil Cloud. You will see its documents on Home once you join.`,
      actionLabel: 'Join workspace',
      actionURL: payload.acceptanceURL,
      footer: `This invitation expires ${new Date(payload.expiresAt).toUTCString()}.`
    },
    `${payload.inviterName} invited you to ${payload.workspaceName}`
  )
}

type EnrollmentMessageKind = Exclude<
  TransactionalEmailKind,
  | 'document-invitation'
  | 'workspace-invitation'
  | 'admin-enrollment-notification'
  | 'email-verification'
  | 'password-reset'
  | 'password-changed'
  | 'email-change-requested'
  | 'new-sign-in'
  | 'two-step-changed'
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

async function renderEnrollment(kind: EnrollmentMessageKind, payload: EnrollmentEmailPayload) {
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
    'email-verification':
      payload.purpose === 'change'
        ? {
            subject: 'Confirm your new OpenPencil Cloud email',
            heading: 'Confirm your new email',
            preview: 'One click to move your OpenPencil Cloud account to this address.',
            message: `Hi ${payload.name}, confirm this address to make it your OpenPencil Cloud account’s email. Your old address stays until you do.`,
            actionLabel: 'Confirm email',
            footer: 'Didn’t ask for this? Ignore this email and nothing changes.'
          }
        : {
            subject: 'Confirm your OpenPencil Cloud email',
            heading: 'Confirm your email',
            preview: 'One click to finish creating your OpenPencil Cloud account.',
            message: `Hi ${payload.name}, confirm this address to finish creating your OpenPencil Cloud account. Then go back to OpenPencil; it signs you in by itself.`,
            actionLabel: 'Confirm email',
            footer: 'Didn’t create an account? Ignore this email and nothing happens.'
          },
    'password-reset': {
      subject: 'Reset your OpenPencil Cloud password',
      heading: 'Reset your password',
      preview: 'Use this secure link to choose a new password.',
      message: `Hi ${payload.name}, use the link below to choose a new password.`,
      actionLabel: 'Reset password',
      footer: 'Didn’t ask for this? Ignore this email and your password stays the same.'
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

async function renderEmailChangeRequested(payload: EmailChangeRequestedPayload) {
  return rendered(
    EnrollmentEmail,
    {
      heading: 'Your email is changing',
      preview: `Your OpenPencil Cloud email is changing to ${payload.newEmail}.`,
      message: `Hi ${payload.name}, someone signed in to your account asked to change its email to ${payload.newEmail}. It changes once that address confirms it. If this wasn’t you, change your password and sign out of your other sessions.`,
      actionLabel: 'Review your account',
      actionURL: payload.actionURL
    },
    'Your OpenPencil Cloud email is changing'
  )
}

async function renderNewSignIn(payload: NewSignInPayload) {
  const device = payload.desktop
    ? 'the OpenPencil app'
    : compact([payload.browser, payload.system]).join(' on ') || 'an unknown browser'
  const place = payload.ipAddress ? ` from ${payload.ipAddress}` : ''
  return rendered(
    EnrollmentEmail,
    {
      heading: 'New sign-in to your account',
      preview: `Your OpenPencil Cloud account was signed in to with ${device}.`,
      message: `Hi ${payload.name}, your account was signed in to with ${device}${place} on ${new Date(payload.signedInAt).toUTCString()}. If this was you, there’s nothing to do. If it wasn’t, sign that session out and change your password.`,
      actionLabel: 'Review sessions',
      actionURL: payload.actionURL
    },
    'New sign-in to your OpenPencil Cloud account'
  )
}

const TWO_STEP_COPY: Record<TwoStepChange, { heading: string; message: string }> = {
  'authenticator-on': {
    heading: 'Authenticator app turned on',
    message: 'an authenticator app now confirms your sign-ins.'
  },
  'authenticator-off': {
    heading: 'Authenticator app turned off',
    message: 'your sign-ins no longer ask for a code from an authenticator app.'
  },
  'passkey-added': {
    heading: 'Passkey added',
    message: 'a passkey was added to your account.'
  },
  'passkey-removed': {
    heading: 'Passkey removed',
    message: 'a passkey was removed from your account.'
  },
  'reset-by-administrator': {
    heading: 'Two-step sign-in was reset',
    message:
      'an administrator removed your authenticator app, recovery codes, and passkeys, so you can set them up again.'
  }
}

async function renderTwoStepChanged(payload: TwoStepChangedPayload) {
  const copy = TWO_STEP_COPY[payload.change]
  return rendered(
    EnrollmentEmail,
    {
      heading: copy.heading,
      preview: `${copy.heading} on your OpenPencil Cloud account.`,
      message: `Hi ${payload.name}, ${copy.message} If this wasn’t you, change your password and contact your administrator.`,
      actionLabel: 'Review security',
      actionURL: payload.actionURL
    },
    `${copy.heading} on your OpenPencil Cloud account`
  )
}

export async function renderTransactionalEmail(
  content: TransactionalEmailContent
): Promise<RenderedTransactionalEmail> {
  if (content.kind === 'document-invitation') return renderDocumentInvitation(content.payload)
  if (content.kind === 'workspace-invitation') return renderWorkspaceInvitation(content.payload)
  if (content.kind === 'admin-enrollment-notification') {
    return renderAdminNotification(content.payload)
  }
  if (
    content.kind === 'email-verification' ||
    content.kind === 'password-reset' ||
    content.kind === 'password-changed'
  ) {
    return renderAuthentication(content.kind, content.payload)
  }
  if (content.kind === 'email-change-requested') return renderEmailChangeRequested(content.payload)
  if (content.kind === 'new-sign-in') return renderNewSignIn(content.payload)
  if (content.kind === 'two-step-changed') return renderTwoStepChanged(content.payload)
  return renderEnrollment(content.kind, content.payload)
}
