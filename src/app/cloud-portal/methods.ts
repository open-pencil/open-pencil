import { CLOUD_SOCIAL_PROVIDER_NAMES, isKnownSocialProvider } from '@open-pencil/cloud/contract'
import { useMessages } from '@open-pencil/vue/i18n'

/**
 * Words for a way an account signs in: `credential` is its password, and a provider keeps its
 * own name; one the portal does not know reads as the server named it.
 */
export function usePortalSignInMethodLabel() {
  const messages = useMessages('cloud/portal')
  return (provider: string): string => {
    if (provider === 'credential') return messages.value.password
    return isKnownSocialProvider(provider) ? CLOUD_SOCIAL_PROVIDER_NAMES[provider] : provider
  }
}
