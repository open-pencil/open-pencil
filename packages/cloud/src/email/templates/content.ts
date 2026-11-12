import type { EmailLocalization, EmailMessages } from '#cloud/email/i18n'

/** What one email says, in its reader's language; the brand layout shows it. */
export type EmailContent = {
  subject: string
  /** The line mail clients show beside the subject. */
  preview: string
  heading: string
  paragraphs: string[]
  action: { label: string; url: string }
  /** Small print under the button; a `{link}` in its text shows the link there. */
  note?: { text: string; link?: { label: string; url: string } }
}

/** One kind of email: its payload in words, in the reader's language. */
export type EmailTemplate<Payload> = (
  payload: Payload,
  localization: EmailLocalization
) => EmailContent

/** "Hi Ada," or, when the account has no name, "Hi,". */
export function greeting(t: EmailMessages, name: string | null): string {
  return name ? t.greeting({ name }) : t.greetingWithoutName
}
