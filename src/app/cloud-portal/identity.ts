import { computed } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { DOCS_URL } from '@/constants'

import { usePortal } from './context'

/** A link the site's chrome shows: a page of this server, or an address elsewhere. */
export type SiteLinkTarget = { label: string; href: string; external?: boolean }

/**
 * Who a Cloud server's public pages speak for. The official server is OpenPencil's own site; a
 * self-hosted one is its operator's, named by `[deployment.branding]` or else its address, with
 * the operator's help and legal links.
 */
export function useSiteIdentity() {
  const portal = usePortal()
  const messages = useCloudPortalMessages()
  const { deployment, branding, legal } = portal.discovery
  const official = deployment === 'official'

  const legalLinks = computed<SiteLinkTarget[]>(() => [
    ...(legal?.termsURL
      ? [{ label: messages.value.termsOfService, href: legal.termsURL, external: true }]
      : []),
    ...(legal?.privacyURL
      ? [{ label: messages.value.privacyPolicy, href: legal.privacyURL, external: true }]
      : []),
    ...(legal?.abuseEmail
      ? [{ label: messages.value.reportAbuse, href: `mailto:${legal.abuseEmail}` }]
      : [])
  ])

  return {
    official,
    name: official ? 'OpenPencil' : (branding?.name ?? portal.host),
    logoURL: official ? undefined : branding?.logoURL,
    /** Where help is: the operator's page, or OpenPencil's documentation. */
    helpURL: (official ? undefined : branding?.helpURL) ?? DOCS_URL,
    /** Whether the operator named a help page of their own. */
    ownHelp: !official && branding?.helpURL !== undefined,
    legalLinks
  }
}
