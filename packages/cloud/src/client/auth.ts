import type { CloudDiscovery } from '#cloud/contract'
import { createAuthClient } from 'better-auth/client'

export type CloudSocialProvider = CloudDiscovery['authentication']['socialProviders'][number]

function returnURL(): string {
  const url = new URL(globalThis.location.href)
  url.hash = ''
  return url.href
}

function authClient(discovery: CloudDiscovery, accessToken?: string) {
  return createAuthClient({
    baseURL: discovery.authURL,
    fetchOptions: {
      credentials: 'include',
      ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {})
    }
  })
}

export async function signInToCloud(
  discovery: CloudDiscovery,
  provider: CloudSocialProvider,
  callbackURL = returnURL()
): Promise<void> {
  if (!discovery.authentication.socialProviders.includes(provider)) {
    throw new Error(`Cloud sign-in provider is unavailable: ${provider}`)
  }
  const result = await authClient(discovery).signIn.social({
    provider,
    callbackURL,
    errorCallbackURL: callbackURL,
    disableRedirect: true
  })
  if (result.error) throw new Error(result.error.message ?? 'Cloud sign-in failed')
  if (typeof result.data.url !== 'string') {
    throw new TypeError('Cloud sign-in response did not include a URL')
  }
  globalThis.location.assign(result.data.url)
}

export async function signOutFromCloud(discovery: CloudDiscovery): Promise<void> {
  const result = await authClient(discovery).signOut()
  if (result.error) throw new Error(result.error.message ?? 'Cloud sign-out failed')
}
