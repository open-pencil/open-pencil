import type { CloudDiscovery } from '#cloud/contract'
import { createAuthClient } from 'better-auth/client'
import { deviceAuthorizationClient } from 'better-auth/client/plugins'

export type CloudSocialProvider = CloudDiscovery['authentication']['socialProviders'][number]

function returnURL(): string {
  const url = new URL(globalThis.location.href)
  url.hash = ''
  return url.href
}

type DeviceActionResult = Promise<{
  data?: { success: boolean }
  error?: { error_description: string }
}>

export type CloudAuthClient = {
  getSession: ReturnType<typeof createAuthClient>['getSession']
  signIn: ReturnType<typeof createAuthClient>['signIn']
  signOut: ReturnType<typeof createAuthClient>['signOut']
  device: {
    (input: { query: { user_code: string } }): Promise<{
      data?: { user_code: string; status: string }
      error?: { error_description: string }
    }>
    approve(input: { userCode: string }): DeviceActionResult
    deny(input: { userCode: string }): DeviceActionResult
  }
}

export function createCloudAuthClient(
  discovery: CloudDiscovery,
  accessToken?: string
): CloudAuthClient {
  return createAuthClient({
    baseURL: discovery.authURL,
    plugins: [deviceAuthorizationClient()],
    fetchOptions: {
      credentials: 'include',
      ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {})
    }
  }) as CloudAuthClient
}

export async function signInToCloud(
  discovery: CloudDiscovery,
  provider: CloudSocialProvider,
  callbackURL = returnURL()
): Promise<void> {
  if (!discovery.authentication.socialProviders.includes(provider)) {
    throw new Error(`Cloud sign-in provider is unavailable: ${provider}`)
  }
  const result = await createCloudAuthClient(discovery).signIn.social({
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
  const result = await createCloudAuthClient(discovery).signOut()
  if (result.error) throw new Error(result.error.message ?? 'Cloud sign-out failed')
}
