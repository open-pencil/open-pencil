import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { CLOUD_LOCALES, type CloudLocale } from '@open-pencil/cloud/contract'
import {
  EMAIL_SAMPLE_URL,
  EMAIL_SAMPLES,
  renderEmail,
  renderTransactionalEmail,
  waitlistConfirmation,
  type TransactionalEmailKind
} from '@open-pencil/cloud/email'

import CloudEmailPreview from './CloudEmailPreview.vue'

type Args = { locale: CloudLocale }

const meta = {
  title: 'App/Cloud/Email',
  args: { locale: 'en' },
  argTypes: { locale: { control: 'select', options: [...CLOUD_LOCALES] } }
} satisfies Meta<Args>

export default meta
type Story = StoryObj<Meta<Args>>

/** The sample email of one kind, rendered as Cloud sends it in the chosen language. */
function sample(kind: TransactionalEmailKind): Story {
  const content = EMAIL_SAMPLES.find((email) => email.kind === kind)
  if (!content) throw new Error(`No sample email of kind ${kind}`)
  return {
    render: (args: Args) => ({
      components: { CloudEmailPreview },
      setup: () => ({ render: () => renderTransactionalEmail(content, args.locale) }),
      template: '<CloudEmailPreview :render="render" />'
    })
  }
}

export const DocumentInvitation = sample('document-invitation')
export const WorkspaceInvitation = sample('workspace-invitation')
export const EnrollmentRequested = sample('enrollment-requested')
export const EnrollmentApproved = sample('enrollment-approved')
export const EnrollmentRejected = sample('enrollment-rejected')
export const EnrollmentRevoked = sample('enrollment-revoked')
export const EnrollmentNotification = sample('admin-enrollment-notification')
export const EmailVerification = sample('email-verification')
export const PasswordReset = sample('password-reset')
export const PasswordChanged = sample('password-changed')
export const EmailChangeRequested = sample('email-change-requested')
export const NewSignIn = sample('new-sign-in')
export const TwoStepChanged = sample('two-step-changed')
export const DocumentReport = sample('document-report')
export const StorageLimitReached = sample('storage-limit-reached')

export const WaitlistConfirmation: Story = {
  render: (args: Args) => ({
    components: { CloudEmailPreview },
    setup: () => ({
      render: () =>
        renderEmail(
          waitlistConfirmation,
          { confirmURL: EMAIL_SAMPLE_URL, leaveURL: 'https://openpencil.dev/waitlist/leave' },
          args.locale
        )
    }),
    template: '<CloudEmailPreview :render="render" />'
  })
}
