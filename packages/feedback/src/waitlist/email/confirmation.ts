import { renderEmail, waitlistConfirmation, type EmailLocale } from '@open-pencil/cloud/email'

/** The confirmation email for a waitlist sign-up; its links carry the sign-up's token only. */
export async function confirmationEmail(
  links: { confirmURL: string; leaveURL: string },
  locale: EmailLocale
) {
  return renderEmail(waitlistConfirmation, links, locale)
}
