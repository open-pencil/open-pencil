import { render } from '@vue-email/render'
import { defineComponent, type PropType } from 'vue'

import { emailLocalization, type EmailLocale, type EmailLocalization } from './i18n'
import type {
  RenderedTransactionalEmail,
  TransactionalEmailContent,
  TransactionalEmailKind,
  TransactionalEmailPayloadByKind
} from './schema'
import {
  emailChangeRequested,
  emailVerification,
  newSignIn,
  passwordChanged,
  passwordReset,
  twoStepChanged
} from './templates/account'
import { emailLayout } from './templates/brand'
import type { EmailContent, EmailTemplate } from './templates/content'
import {
  documentReport,
  enrollmentApproved,
  enrollmentNotification,
  enrollmentRejected,
  enrollmentRequested,
  enrollmentRevoked
} from './templates/enrollment'
import { documentInvitation, workspaceInvitation } from './templates/invitations'
import { storageLimitReached } from './templates/storage'

const TEMPLATES: {
  [Kind in TransactionalEmailKind]: EmailTemplate<TransactionalEmailPayloadByKind[Kind]>
} = {
  'document-invitation': documentInvitation,
  'workspace-invitation': workspaceInvitation,
  'enrollment-requested': enrollmentRequested,
  'admin-enrollment-notification': enrollmentNotification,
  'enrollment-approved': enrollmentApproved,
  'enrollment-rejected': enrollmentRejected,
  'enrollment-revoked': enrollmentRevoked,
  'email-verification': emailVerification,
  'password-reset': passwordReset,
  'password-changed': passwordChanged,
  'email-change-requested': emailChangeRequested,
  'new-sign-in': newSignIn,
  'two-step-changed': twoStepChanged,
  'document-report': documentReport,
  'storage-limit-reached': storageLimitReached
}

/** An email's content in the brand layout, in its reader's language and direction. */
const BrandEmail = defineComponent({
  props: {
    content: { type: Object as PropType<EmailContent>, required: true },
    localization: { type: Object as PropType<EmailLocalization>, required: true }
  },
  setup(props) {
    return () => {
      const { content, localization } = props
      return emailLayout({
        lang: localization.locale,
        dir: localization.dir,
        preview: content.preview,
        heading: content.heading,
        paragraphs: content.paragraphs,
        actionLabel: content.action.label,
        actionURL: content.action.url,
        note: content.note,
        tagline: localization.t.footer
      })
    }
  }
})

/** Renders a template's email as HTML and as plain text, in `locale`. */
export async function renderEmail<Payload>(
  template: EmailTemplate<Payload>,
  payload: Payload,
  locale: EmailLocale
): Promise<RenderedTransactionalEmail> {
  const localization = emailLocalization(locale)
  const content = template(payload, localization)
  const props = { content, localization }
  const [html, text] = await Promise.all([
    render(BrandEmail, props),
    render(BrandEmail, props, { plainText: true })
  ])
  return { subject: content.subject, html, text }
}

function renderKind<Kind extends TransactionalEmailKind>(
  kind: Kind,
  payload: TransactionalEmailPayloadByKind[Kind],
  locale: EmailLocale
) {
  return renderEmail(TEMPLATES[kind], payload, locale)
}

export async function renderTransactionalEmail(
  content: TransactionalEmailContent,
  locale: EmailLocale
): Promise<RenderedTransactionalEmail> {
  return renderKind(content.kind, content.payload, locale)
}
