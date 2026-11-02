import {
  cloudAuthFailure,
  createCloudAuthClient,
  resendCloudVerification,
  signInToCloudWithEmail,
  signUpToCloudWithEmail,
  type CloudAuthResult,
  type CloudSocialProvider
} from '@open-pencil/cloud/client'
import type { CloudDiscovery } from '@open-pencil/cloud/contract'

const done = <T>(value: T): CloudAuthResult<T> => ({ ok: true, value })

/** Sign-in steps against the Cloud server the portal is served from. */
export function createPortalAuth(discovery: CloudDiscovery, options: { captcha?: string } = {}) {
  const captcha = { captchaResponse: options.captcha }
  const auth = createCloudAuthClient(discovery, captcha)

  return {
    /** Leaves for the provider; the browser comes back to `returnURL`. */
    async withProvider(provider: CloudSocialProvider, returnURL: string): Promise<CloudAuthResult> {
      const result = await auth.signIn.social({
        provider,
        callbackURL: returnURL,
        errorCallbackURL: returnURL,
        disableRedirect: true
      })
      if (result.error || typeof result.data.url !== 'string') return cloudAuthFailure(result.error)
      globalThis.location.assign(result.data.url)
      return done(undefined)
    },

    async withEmail(input: {
      email: string
      password: string
    }): Promise<CloudAuthResult<'signed-in' | 'two-step'>> {
      const result = await signInToCloudWithEmail(discovery, input, captcha)
      return result.ok ? done(result.value.status) : result
    },

    signUp: (input: { name: string; email: string; password: string; verifiedURL: string }) =>
      signUpToCloudWithEmail(discovery, input, captcha),

    resendVerification: (email: string, verifiedURL: string) =>
      resendCloudVerification(discovery, { email, verifiedURL }, captcha),

    async requestPasswordReset(email: string, resetURL: string): Promise<CloudAuthResult> {
      const result = await auth.requestPasswordReset({ email, redirectTo: resetURL })
      return result.error ? cloudAuthFailure(result.error) : done(undefined)
    },

    async resetPassword(token: string, password: string): Promise<CloudAuthResult> {
      const result = await auth.resetPassword({ newPassword: password, token })
      return result.error ? cloudAuthFailure(result.error) : done(undefined)
    },

    async verifyTwoStep(
      method: 'authenticator' | 'recovery',
      code: string
    ): Promise<CloudAuthResult> {
      const result =
        method === 'authenticator'
          ? await auth.twoFactor.verifyTotp({ code, trustDevice: true })
          : await auth.twoFactor.verifyBackupCode({ code, trustDevice: true })
      return result.error ? cloudAuthFailure(result.error) : done(undefined)
    },

    async withPasskey(): Promise<CloudAuthResult> {
      const result = await auth.signIn.passkey()
      return result.error ? cloudAuthFailure(result.error) : done(undefined)
    },

    async addPasskey(): Promise<CloudAuthResult> {
      const result = await auth.passkey.addPasskey()
      return result.error ? cloudAuthFailure(result.error) : done(undefined)
    },

    /** Whether a desktop sign-in code is still waiting, before showing it to approve. */
    async deviceRequest(
      userCode: string
    ): Promise<CloudAuthResult<'pending' | 'approved' | 'denied'>> {
      const result = await auth.device({ query: { user_code: userCode } })
      // An unknown or expired code is the only failure a person can act on: start again.
      if (result.error || !result.data) return { ok: false, failure: 'invalid-code' }
      const status = result.data.status
      return done(status === 'approved' || status === 'denied' ? status : 'pending')
    },

    async decideDevice(userCode: string, decision: 'approve' | 'deny'): Promise<CloudAuthResult> {
      const result = await auth.device[decision]({ userCode }).catch(() => null)
      if (!result) return { ok: false, failure: 'unavailable' }
      const { error } = result
      const status =
        error && 'status' in error && typeof error.status === 'number' ? error.status : undefined
      if (status === 429) return { ok: false, failure: 'rate-limited' }
      // A code that is unknown, used, or expired is refused with a 4xx; anything else can be retried.
      if (status !== undefined && (status < 400 || status >= 500)) {
        return { ok: false, failure: 'unavailable' }
      }
      return error || !result.data?.success
        ? { ok: false, failure: 'invalid-code' }
        : done(undefined)
    },

    async signOut(): Promise<void> {
      await auth.signOut()
    }
  }
}

export type PortalAuth = ReturnType<typeof createPortalAuth>
