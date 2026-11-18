import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

/**
 * Words for a way an account signs in: `credential` is its password, and a provider keeps its
 * own name; one the portal does not know reads as the server named it.
 */
export function usePortalSignInMethodLabel() {
  const messages = useCloudPortalMessages()
  return (provider: string): string => {
    const words = messages.value
    const labels: Record<string, string> = {
      credential: words.password,
      google: words.providerGoogle,
      apple: words.providerApple
    }
    return labels[provider] ?? provider
  }
}
