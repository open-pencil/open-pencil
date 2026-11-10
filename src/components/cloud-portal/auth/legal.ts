import type { CloudLegalDiscovery } from '@open-pencil/cloud/contract'
import type { useCloudPortalMessages } from '@open-pencil/vue/i18n'

type CloudPortalMessages = ReturnType<typeof useCloudPortalMessages>['value']

/** The links a legal sentence's `{terms}` and `{privacy}` placeholders become. */
export function legalLinks(messages: CloudPortalMessages, legal: CloudLegalDiscovery | undefined) {
  return {
    terms: legal?.termsURL ? { href: legal.termsURL, label: messages.termsOfService } : undefined,
    privacy: legal?.privacyURL
      ? { href: legal.privacyURL, label: messages.privacyPolicy }
      : undefined
  }
}

/** Placeholders kept as written, for `PortalLinkedText` to turn into links. */
const PLACEHOLDERS = { terms: '{terms}', privacy: '{privacy}' }

/** What continuing agrees to, for the documents this server names, or null when it names none. */
export function legalSentence(
  messages: CloudPortalMessages,
  legal: CloudLegalDiscovery
): string | null {
  if (legal.termsURL && legal.privacyURL) return messages.consentTermsAndPrivacy(PLACEHOLDERS)
  if (legal.termsURL) return messages.consentTerms(PLACEHOLDERS)
  if (legal.privacyURL) return messages.consentPrivacy(PLACEHOLDERS)
  return null
}

/** The terms page's description: read and accept the terms, and where the privacy policy is. */
export function termsDescription(
  messages: CloudPortalMessages,
  legal: CloudLegalDiscovery,
  host: string
): string {
  const accept = messages.termsDescription({ ...PLACEHOLDERS, host })
  return legal.privacyURL ? `${accept} ${messages.consentPrivacy(PLACEHOLDERS)}` : accept
}
