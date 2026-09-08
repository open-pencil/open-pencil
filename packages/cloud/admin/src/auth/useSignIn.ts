import { useMutation } from '@tanstack/vue-query'

import type { CloudDiscovery } from '@open-pencil/cloud/contract'

import { startSocialAuthentication, type CloudAuthIntent, type CloudAuthProvider } from './client'

export function useSignIn(
  discovery: () => CloudDiscovery | undefined,
  intent: CloudAuthIntent,
  callbackURL: () => string
) {
  const mutation = useMutation({
    mutationKey: ['cloud', 'auth', 'sign-in'],
    mutationFn: (provider: CloudAuthProvider) => {
      const instance = discovery()
      if (!instance) throw new Error('cloud_discovery_unavailable')
      return startSocialAuthentication(instance, provider, intent, callbackURL())
    }
  })
  return { mutation, start: (provider: CloudAuthProvider) => mutation.mutate(provider) }
}
