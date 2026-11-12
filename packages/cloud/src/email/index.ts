export {
  acceptedLocale,
  emailLocalization,
  type EmailLocalization,
  type EmailMessages
} from './i18n'
export { emailMessageDefaults } from './messages'
export { renderEmail, renderTransactionalEmail } from './render'
export { EMAIL_SAMPLE_URL, EMAIL_SAMPLES } from './samples'
export { transactionalEmailContentSchema } from './schema'
export type { EmailContent, EmailTemplate } from './templates/content'
export { waitlistConfirmation } from './templates/waitlist'
export type {
  AdminEnrollmentNotificationPayload,
  DocumentInvitationEmailPayload,
  EnrollmentEmailPayload,
  RenderedTransactionalEmail,
  TransactionalEmailContent,
  TransactionalEmailKind,
  TransactionalEmailMessage,
  TransactionalEmailPayloadByKind,
  TwoStepChange
} from './schema'
