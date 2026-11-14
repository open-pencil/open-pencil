import { render } from '@vue-email/render'
import type { Component } from 'vue'

import {
  emailLocalization,
  type EmailLocale,
  type EmailLocalization,
  type EmailMessages
} from './i18n'
import type {
  DocumentInvitationEmailPayload,
  RenderedTransactionalEmail,
  TransactionalEmailContent,
  TransactionalEmailKind,
  TransactionalEmailPayloadByKind
} from './schema'
import DocumentBlocked from './templates/DocumentBlocked.vue'
import DocumentInvitation from './templates/DocumentInvitation.vue'
import DocumentReport from './templates/DocumentReport.vue'
import DocumentReportDecided from './templates/DocumentReportDecided.vue'
import DocumentReportReceived from './templates/DocumentReportReceived.vue'
import DocumentRestored from './templates/DocumentRestored.vue'
import EmailChangeRequested from './templates/EmailChangeRequested.vue'
import EmailRoot from './templates/EmailRoot.vue'
import EmailVerification from './templates/EmailVerification.vue'
import EnrollmentNotification from './templates/EnrollmentNotification.vue'
import EnrollmentUpdate from './templates/EnrollmentUpdate.vue'
import NewSignIn from './templates/NewSignIn.vue'
import PasswordChanged from './templates/PasswordChanged.vue'
import PasswordReset from './templates/PasswordReset.vue'
import StorageLimitReached from './templates/StorageLimitReached.vue'
import TwoStepChanged from './templates/TwoStepChanged.vue'
import WaitlistConfirmation from './templates/WaitlistConfirmation.vue'
import WorkspaceInvitation from './templates/WorkspaceInvitation.vue'

/** One kind of email: the component that draws it from its payload, and its subject line. */
type EmailDefinition<Payload> = {
  component: Component
  /** What the component takes besides `payload`. */
  props?: Record<string, unknown>
  subject: (payload: Payload, t: EmailMessages) => string
}

function documentInvitationSubject(payload: DocumentInvitationEmailPayload, t: EmailMessages) {
  const names = { inviter: payload.inviterName ?? t.someone, document: payload.documentName }
  return payload.permission === 'edit'
    ? t.documentInvitationEditSubject(names)
    : t.documentInvitationViewSubject(names)
}

const EMAILS: {
  [Kind in TransactionalEmailKind]: EmailDefinition<TransactionalEmailPayloadByKind[Kind]>
} = {
  'document-invitation': { component: DocumentInvitation, subject: documentInvitationSubject },
  'workspace-invitation': {
    component: WorkspaceInvitation,
    subject: (payload, t) =>
      t.workspaceInvitationSubject({
        inviter: payload.inviterName ?? t.someone,
        workspace: payload.workspaceName
      })
  },
  'enrollment-requested': {
    component: EnrollmentUpdate,
    props: { kind: 'requested' },
    subject: (_payload, t) => t.enrollmentRequestedSubject
  },
  'enrollment-approved': {
    component: EnrollmentUpdate,
    props: { kind: 'approved' },
    subject: (_payload, t) => t.enrollmentApprovedSubject
  },
  'enrollment-rejected': {
    component: EnrollmentUpdate,
    props: { kind: 'rejected' },
    subject: (_payload, t) => t.enrollmentRejectedSubject
  },
  'enrollment-revoked': {
    component: EnrollmentUpdate,
    props: { kind: 'revoked' },
    subject: (_payload, t) => t.enrollmentRevokedSubject
  },
  'admin-enrollment-notification': {
    component: EnrollmentNotification,
    subject: (_payload, t) => t.enrollmentNotificationSubject
  },
  'email-verification': {
    component: EmailVerification,
    subject: (payload, t) =>
      payload.purpose === 'change' ? t.verifyChangeSubject : t.verifyAccountSubject
  },
  'password-reset': { component: PasswordReset, subject: (_payload, t) => t.passwordResetSubject },
  'password-changed': {
    component: PasswordChanged,
    subject: (_payload, t) => t.passwordChangedSubject
  },
  'email-change-requested': {
    component: EmailChangeRequested,
    subject: (_payload, t) => t.emailChangeSubject
  },
  'new-sign-in': { component: NewSignIn, subject: (_payload, t) => t.newSignInSubject },
  'two-step-changed': { component: TwoStepChanged, subject: (_payload, t) => t.twoStepSubject },
  'document-report': {
    component: DocumentReport,
    subject: (_payload, t) => t.documentReportSubject
  },
  'storage-limit-reached': {
    component: StorageLimitReached,
    subject: (_payload, t) => t.storageFullSubject
  },
  'document-blocked': {
    component: DocumentBlocked,
    subject: (payload, t) => t.documentBlockedSubject({ document: payload.documentName })
  },
  'document-restored': {
    component: DocumentRestored,
    subject: (payload, t) => t.documentRestoredSubject({ document: payload.documentName })
  },
  'document-report-received': {
    component: DocumentReportReceived,
    subject: (payload, t) => t.reportReceivedSubject({ document: payload.documentName })
  },
  'document-report-decided': {
    component: DocumentReportDecided,
    subject: (payload, t) => t.reportDecidedSubject({ document: payload.documentName })
  }
}

/** Renders an email component as HTML and as plain text, in its reader's language. */
async function renderComponent(
  email: Component,
  props: Record<string, unknown>,
  subject: string,
  localization: EmailLocalization
): Promise<RenderedTransactionalEmail> {
  const root = { email, props, localization }
  const [html, text] = await Promise.all([
    render(EmailRoot, root),
    render(EmailRoot, root, { plainText: true })
  ])
  return { subject, html, text }
}

function renderKind<Kind extends TransactionalEmailKind>(
  kind: Kind,
  payload: TransactionalEmailPayloadByKind[Kind],
  localization: EmailLocalization
) {
  const { component, props, subject } = EMAILS[kind]
  const content = { ...props, payload }
  return renderComponent(component, content, subject(payload, localization.t), localization)
}

export async function renderTransactionalEmail(
  content: TransactionalEmailContent,
  locale: EmailLocale
): Promise<RenderedTransactionalEmail> {
  return renderKind(content.kind, content.payload, emailLocalization(locale))
}

/** The waitlist's confirmation email, which the feedback service sends rather than Cloud. */
export async function renderWaitlistConfirmation(
  links: { confirmURL: string; leaveURL: string },
  locale: EmailLocale
): Promise<RenderedTransactionalEmail> {
  const localization = emailLocalization(locale)
  return renderComponent(WaitlistConfirmation, links, localization.t.waitlistSubject, localization)
}
