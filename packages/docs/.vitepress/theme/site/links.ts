import { LINKS } from '../landing/content/links'
import type { SiteMessages } from './messages'

export type FooterLink = { label: string; href: string }
export type FooterColumn = { title: string; links: FooterLink[] }

/** The editor on the web. */
export const APP_URL = 'https://app.openpencil.dev'

const SECURITY_POLICY = 'https://github.com/open-pencil/open-pencil/security/policy'
const DISCORD = 'https://discord.gg/4wXc9fuZfm'

/**
 * The footer's link columns for a docs locale. Pages that have a translation link inside the
 * locale; the Cloud and legal pages exist only in English, so every locale links to those.
 */
export function footerColumns(messages: SiteMessages, localeIndex: string): FooterColumn[] {
  const translated = (path: string) => (localeIndex === 'root' ? path : `/${localeIndex}${path}`)
  return [
    {
      title: messages.product,
      links: [
        { label: messages.openApp, href: APP_URL },
        { label: messages.download, href: translated(LINKS.downloadPage) },
        { label: messages.cloud, href: '/cloud/' }
      ]
    },
    {
      title: messages.resources,
      links: [
        { label: messages.docs, href: translated(LINKS.docs) },
        { label: messages.sdk, href: translated('/programmable/sdk/') },
        { label: 'GitHub', href: LINKS.github },
        { label: 'Discord', href: DISCORD }
      ]
    },
    {
      title: messages.legal,
      links: [
        { label: messages.terms, href: '/cloud/legal/terms' },
        { label: messages.privacy, href: '/cloud/legal/privacy' },
        { label: messages.security, href: SECURITY_POLICY },
        { label: messages.reportAbuse, href: '/cloud/support#the-hosted-service' }
      ]
    }
  ]
}
