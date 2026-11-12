import type { EmailTemplate } from './content'

/** Asks a waitlist sign-up to confirm its address; its links carry the sign-up's token only. */
export const waitlistConfirmation: EmailTemplate<{ confirmURL: string; leaveURL: string }> = (
  links,
  { t }
) => ({
  subject: t.waitlistSubject,
  preview: t.waitlistPreview,
  heading: t.waitlistHeading,
  paragraphs: [t.waitlist],
  action: { label: t.waitlistAction, url: links.confirmURL },
  note: { text: t.waitlistNote, link: { label: t.waitlistLeave, url: links.leaveURL } }
})
