import type { CloudDiscovery } from '#cloud/contract'

export type CloudSocialSignInResponse = {
  url?: unknown
}

export type CloudSocialProvider = CloudDiscovery['authentication']['socialProviders'][number]

function returnURL(): string {
  const url = new URL(globalThis.location.href)
  url.hash = ''
  return url.href
}

export async function signInToCloud(
  discovery: CloudDiscovery,
  provider: CloudSocialProvider,
  callbackURL = returnURL()
): Promise<void> {
  if (!discovery.authentication.socialProviders.includes(provider)) {
    throw new Error(`Cloud sign-in provider is unavailable: ${provider}`)
  }
  const response = await fetch(`${discovery.authURL}/sign-in/social`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      provider,
      callbackURL,
      errorCallbackURL: callbackURL,
      disableRedirect: true
    })
  })
  if (!response.ok) throw new Error(`Cloud sign-in failed with HTTP ${response.status}`)
  const body = (await response.json()) as CloudSocialSignInResponse
  if (typeof body.url !== 'string') throw new Error('Cloud sign-in response did not include a URL')
  globalThis.location.assign(body.url)
}

export async function signOutFromCloud(discovery: CloudDiscovery): Promise<void> {
  const response = await fetch(`${discovery.authURL}/sign-out`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' }
  })
  if (!response.ok) throw new Error(`Cloud sign-out failed with HTTP ${response.status}`)
}
