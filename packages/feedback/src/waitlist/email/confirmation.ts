import { render } from '@vue-email/render'
import { defineComponent } from 'vue'

import { emailLayout } from '@open-pencil/cloud/email'

const ConfirmationEmail = defineComponent({
  props: {
    confirmURL: { type: String, required: true },
    leaveURL: { type: String, required: true }
  },
  setup(props) {
    return () =>
      emailLayout({
        preview: 'One click to join the OpenPencil Cloud waitlist.',
        heading: 'Confirm your email',
        message:
          'Thanks for your interest in OpenPencil Cloud. Confirm this address to join the waitlist, and we will write once, when Cloud is ready for you.',
        actionLabel: 'Join the waitlist',
        actionURL: props.confirmURL,
        note: {
          text: 'Did not sign up? Ignore this email and the address is deleted in seven days, or',
          link: { label: 'remove it now', url: props.leaveURL }
        }
      })
  }
})

/** The confirmation email for a waitlist sign-up; its links carry the sign-up's token only. */
export async function confirmationEmail(links: { confirmURL: string; leaveURL: string }) {
  const [html, text] = await Promise.all([
    render(ConfirmationEmail, links),
    render(ConfirmationEmail, links, { plainText: true })
  ])
  return { subject: 'Confirm your place on the OpenPencil Cloud waitlist', html, text }
}
