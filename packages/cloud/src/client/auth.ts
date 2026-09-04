import type { CloudDiscovery } from '#cloud/contract'
import { passkeyClient } from '@better-auth/passkey/client'
import { createAuthClient } from 'better-auth/client'
import { deviceAuthorizationClient, twoFactorClient } from 'better-auth/client/plugins'

import type { CloudFetch } from './discovery'

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

export type CloudAuthClient = Pick<
  ReturnType<typeof createAuthClient>,
  | 'getSession'
  | 'signIn'
  | 'signOut'
  | 'signUp'
  | 'sendVerificationEmail'
  | 'requestPasswordReset'
  | 'resetPassword'
> & {
  signIn: ReturnType<typeof createAuthClient>['signIn'] & {
    passkey(): Promise<{
      data: unknown
      error: { message?: string; code?: string; status: number } | null
    }>
  }
  twoFactor: {
    verifyTotp(input: { code: string; trustDevice?: boolean }): Promise<{
      data: unknown
      error: { message?: string; code?: string; status: number } | null
    }>
    verifyBackupCode(input: { code: string; trustDevice?: boolean }): Promise<{
      data: unknown
      error: { message?: string; code?: string; status: number } | null
    }>
  }
  passkey: {
    addPasskey(input?: { name?: string }): Promise<{
      data: unknown
      error: { message?: string; code?: string; status: number } | null
    }>
  }
  device: {
    (input: { query: { user_code: string } }): Promise<{
      data?: { user_code: string; status: string }
      error?: { error_description: string }
    }>
    approve(input: { userCode: string }): DeviceActionResult
    deny(input: { userCode: string }): DeviceActionResult
  }
}

export type CloudAuthClientOptions = {
  accessToken?: string
  captchaResponse?: string
  fetch?: CloudFetch
}

function authHeaders(options: CloudAuthClientOptions): HeadersInit | undefined {
  const headers: Record<string, string> = {}
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`
  if (options.captchaResponse) headers['x-captcha-response'] = options.captchaResponse
  return Object.keys(headers).length > 0 ? headers : undefined
}

export function createCloudAuthClient(
  discovery: CloudDiscovery,
  options: CloudAuthClientOptions = {}
): CloudAuthClient {
  return createAuthClient({
    baseURL: discovery.authURL,
    plugins: [
      deviceAuthorizationClient(),
      twoFactorClient({ twoFactorPage: '/auth/two-factor' }),
      passkeyClient()
    ],
    fetchOptions: {
      credentials: 'include',
      customFetchImpl: options.fetch,
      headers: authHeaders(options)
    }
  }) as CloudAuthClient
}

export type CloudSignInOptions = {
  callbackURL?: string
  fetch?: CloudFetch
  navigate?: (url: string) => void
}

export async function signInToCloud(
  discovery: CloudDiscovery,
  provider: CloudSocialProvider,
  options: CloudSignInOptions = {}
): Promise<void> {
  const callbackURL = options.callbackURL ?? returnURL()
  if (!discovery.authentication.socialProviders.includes(provider)) {
    throw new Error(`Cloud sign-in provider is unavailable: ${provider}`)
  }
  const result = await createCloudAuthClient(discovery, { fetch: options.fetch }).signIn.social({
    provider,
    callbackURL,
    errorCallbackURL: callbackURL,
    disableRedirect: true
  })
  if (result.error) throw new Error(result.error.message ?? 'Cloud sign-in failed')
  if (typeof result.data.url !== 'string') {
    throw new TypeError('Cloud sign-in response did not include a URL')
  }
  const navigate = options.navigate ?? ((url: string) => globalThis.location.assign(url))
  navigate(result.data.url)
}

export async function signOutFromCloud(
  discovery: CloudDiscovery,
  options: Pick<CloudAuthClientOptions, 'fetch'> = {}
): Promise<void> {
  const result = await createCloudAuthClient(discovery, options).signOut()
  if (result.error) throw new Error(result.error.message ?? 'Cloud sign-out failed')
}
