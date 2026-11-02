import type { CloudDiscovery } from '#cloud/contract'
import { passkeyClient } from '@better-auth/passkey/client'
import { createAuthClient } from 'better-auth/client'
import { deviceAuthorizationClient, twoFactorClient } from 'better-auth/client/plugins'
import { withoutFragment } from 'ufo'

import type { CloudFetch } from '../discovery'
import { cloudAuthFailure, type CloudAuthResult } from './failure'

export type CloudSocialProvider = CloudDiscovery['authentication']['socialProviders'][number]

function returnURL(): string {
  return withoutFragment(globalThis.location.href)
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
  options: Pick<CloudAuthClientOptions, 'fetch' | 'accessToken'> = {}
): Promise<void> {
  const result = await createCloudAuthClient(discovery, options).signOut()
  if (result.error) throw new Error(result.error.message ?? 'Cloud sign-out failed')
}

/** An email sign-in that went through: the session's bearer token, or a second step to take. */
export type CloudEmailSignIn = { status: 'signed-in'; token: string } | { status: 'two-step' }

type CloudEmailAuthOptions = Pick<CloudAuthClientOptions, 'fetch' | 'captchaResponse'>

/**
 * Signs in with an email and password without leaving the app. The token goes on every later
 * request, so no cookie has to cross from the server to the editor.
 */
export async function signInToCloudWithEmail(
  discovery: CloudDiscovery,
  input: { email: string; password: string },
  options: CloudEmailAuthOptions = {}
): Promise<CloudAuthResult<CloudEmailSignIn>> {
  const result = await createCloudAuthClient(discovery, options)
    .signIn.email({ ...input, rememberMe: true })
    .catch(() => null)
  if (!result) return cloudAuthFailure(null)
  if (result.error) return cloudAuthFailure(result.error)
  if ('twoFactorRedirect' in result.data && result.data.twoFactorRedirect === true) {
    return { ok: true, value: { status: 'two-step' } }
  }
  if (!('token' in result.data) || typeof result.data.token !== 'string') {
    return cloudAuthFailure(null)
  }
  return { ok: true, value: { status: 'signed-in', token: result.data.token } }
}

/** Creates an account; the server emails a link that opens `verifiedURL` once it is confirmed. */
export async function signUpToCloudWithEmail(
  discovery: CloudDiscovery,
  input: { name: string; email: string; password: string; verifiedURL: string },
  options: CloudEmailAuthOptions = {}
): Promise<CloudAuthResult> {
  const result = await createCloudAuthClient(discovery, options)
    .signUp.email({
      name: input.name,
      email: input.email,
      password: input.password,
      callbackURL: input.verifiedURL
    })
    .catch(() => null)
  if (!result) return cloudAuthFailure(null)
  return result.error ? cloudAuthFailure(result.error) : { ok: true, value: undefined }
}

export async function resendCloudVerification(
  discovery: CloudDiscovery,
  input: { email: string; verifiedURL: string },
  options: CloudEmailAuthOptions = {}
): Promise<CloudAuthResult> {
  const result = await createCloudAuthClient(discovery, options)
    .sendVerificationEmail({ email: input.email, callbackURL: input.verifiedURL })
    .catch(() => null)
  if (!result) return cloudAuthFailure(null)
  return result.error ? cloudAuthFailure(result.error) : { ok: true, value: undefined }
}
