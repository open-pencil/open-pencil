import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  // eslint-disable-next-line open-pencil/no-mixed-case-acronym-identifiers -- Upstream export spelling.
  Html as HTML,
  Img,
  Link,
  Preview,
  Section,
  Text
} from '@vue-email/components'
import { h, type VNode } from 'vue'

/** The ivory app-icon tile, served as PNG because mail clients do not draw SVG. */
const LOGO_URL = 'https://openpencil.dev/brand/app-icon-1024.png'
const SITE_URL = 'https://openpencil.dev'

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const INK = '#171717'
const MUTED = '#6B6B6B'
/** Deep teal from the mark; white text on it passes WCAG AA. */
const TEAL = '#0A6C65'

const styles = {
  body: { backgroundColor: '#F5F5EF', fontFamily: FONT, margin: '0', padding: '40px 16px' },
  card: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '40px',
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E7E5DC'
  },
  logo: { borderRadius: '10px', margin: '0 0 28px' },
  heading: {
    color: INK,
    fontSize: '22px',
    fontWeight: '600',
    lineHeight: '1.3',
    margin: '0 0 12px'
  },
  text: { color: '#404040', fontSize: '15px', lineHeight: '1.6', margin: '0 0 24px' },
  button: {
    backgroundColor: TEAL,
    borderRadius: '10px',
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: '600',
    padding: '12px 22px',
    textDecoration: 'none'
  },
  note: { color: MUTED, fontSize: '13px', lineHeight: '1.6', margin: '28px 0 0' },
  link: { color: TEAL, textDecoration: 'underline' },
  footer: {
    color: MUTED,
    fontSize: '12px',
    lineHeight: '1.6',
    textAlign: 'center' as const,
    margin: '24px 0 0'
  }
}

export type EmailLayoutProps = {
  /** The line mail clients show beside the subject. */
  preview: string
  heading: string
  message: string
  actionLabel: string
  actionURL: string
  /** Small print under the button, with an optional link at its end. */
  note?: { text: string; link?: { label: string; url: string } }
}

function noteContent(note: NonNullable<EmailLayoutProps['note']>) {
  if (!note.link) return note.text
  const { label, url } = note.link
  return [`${note.text} `, h(Link, { href: url, style: styles.link }, () => label), '.']
}

/** The branded email every OpenPencil service sends: the waitlist and Cloud alike. */
export function emailLayout(props: EmailLayoutProps): VNode {
  const { note } = props
  return h(HTML, { lang: 'en' }, () => [
    h(Head),
    h(Preview, () => props.preview),
    h(Body, { style: styles.body }, () => [
      h(Container, { style: styles.card }, () => [
        h(Img, { src: LOGO_URL, width: 44, height: 44, alt: 'OpenPencil', style: styles.logo }),
        h(Heading, { as: 'h1', style: styles.heading }, () => props.heading),
        h(Text, { style: styles.text }, () => props.message),
        h(Section, () =>
          h(Button, { href: props.actionURL, style: styles.button }, () => props.actionLabel)
        ),
        note ? h(Text, { style: styles.note }, () => noteContent(note)) : null
      ]),
      h(Text, { style: styles.footer }, () => [
        'OpenPencil, the open-source design editor · ',
        h(Link, { href: SITE_URL, style: { color: MUTED } }, () => 'openpencil.dev')
      ])
    ])
  ])
}
