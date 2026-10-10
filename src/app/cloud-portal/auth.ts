import { createCloudAuthClient, type CloudSocialProvider } from '@open-pencil/cloud/client'
import type { CloudDiscovery } from '@open-pencil/cloud/contract'

/** Why a sign-in step did not go through, in terms a page can explain. */
export type PortalAuthFailure =
  | 'invalid-credentials'
  | 'email-not-verified'
  | 'password-too-short'
  | 'password-too-long'
  | 'invalid-link'
  | 'invalid-code'
  | 'rate-limited'
  | 'unavailable'

export type PortalAuthResult<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; failure: PortalAuthFailure }

type BetterAuthError = { code?: string; status?: number } | null | undefined

function failure(error: BetterAuthError): { ok: false; failure: PortalAuthFailure } {
  if (error?.status === 429) return { ok: false, failure: 'rate-limited' }
  switch (error?.code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return { ok: false, failure: 'invalid-credentials' }
    case 'EMAIL_NOT_VERIFIED':
      return { ok: false, failure: 'email-not-verified' }
    case 'PASSWORD_TOO_SHORT':
      return { ok: false, failure: 'password-too-short' }
    case 'PASSWORD_TOO_LONG':
      return { ok: false, failure: 'password-too-long' }
    case 'INVALID_TOKEN':
      return { ok: false, failure: 'invalid-link' }
    case 'INVALID_CODE':
    case 'INVALID_TWO_FACTOR_CODE':
    case 'INVALID_BACKUP_CODE':
      return { ok: false, failure: 'invalid-code' }
    default:
      return { ok: false, failure: 'unavailable' }
  }
}

const done = <T>(value: T): PortalAuthResult<T> => ({ ok: true, value })

/** Sign-in steps against the Cloud server the portal is served from. */
export function createPortalAuth(discovery: CloudDiscovery, options: { captcha?: string } = {}) {
  const auth = createCloudAuthClient(discovery, { captchaResponse: options.captcha })

  return {
    /** Leaves for the provider; the browser comes back to `returnURL`. */
    async withProvider(
      provider: CloudSocialProvider,
      returnURL: string
    ): Promise<PortalAuthResult> {
      const result = await auth.signIn.social({
        provider,
        callbackURL: returnURL,
        errorCallbackURL: returnURL,
        disableRedirect: true
      })
      if (result.error || typeof result.data.url !== 'string') return failure(result.error)
      globalThis.location.assign(result.data.url)
      return done(undefined)
    },

    async withEmail(input: {
      email: string
      password: string
    }): Promise<PortalAuthResult<'signed-in' | 'two-step'>> {
      const result = await auth.signIn.email({ ...input, rememberMe: true })
      if (result.error) return failure(result.error)
      const twoStep = 'twoFactorRedirect' in result.data && result.data.twoFactorRedirect === true
      return done(twoStep ? 'two-step' : 'signed-in')
    },

    async signUp(input: {
      name: string
      email: string
      password: string
      verifiedURL: string
    }): Promise<PortalAuthResult> {
      const result = await auth.signUp.email({
        name: input.name,
        email: input.email,
        password: input.password,
        callbackURL: input.verifiedURL
      })
      return result.error ? failure(result.error) : done(undefined)
    },

    async resendVerification(email: string, verifiedURL: string): Promise<PortalAuthResult> {
      const result = await auth.sendVerificationEmail({ email, callbackURL: verifiedURL })
      return result.error ? failure(result.error) : done(undefined)
    },

    async requestPasswordReset(email: string, resetURL: string): Promise<PortalAuthResult> {
      const result = await auth.requestPasswordReset({ email, redirectTo: resetURL })
      return result.error ? failure(result.error) : done(undefined)
    },

    async resetPassword(token: string, password: string): Promise<PortalAuthResult> {
      const result = await auth.resetPassword({ newPassword: password, token })
      return result.error ? failure(result.error) : done(undefined)
    },

    async verifyTwoStep(
      method: 'authenticator' | 'recovery',
      code: string
    ): Promise<PortalAuthResult> {
      const result =
        method === 'authenticator'
          ? await auth.twoFactor.verifyTotp({ code, trustDevice: true })
          : await auth.twoFactor.verifyBackupCode({ code, trustDevice: true })
      return result.error ? failure(result.error) : done(undefined)
    },

    async withPasskey(): Promise<PortalAuthResult> {
      const result = await auth.signIn.passkey()
      return result.error ? failure(result.error) : done(undefined)
    },

    async addPasskey(): Promise<PortalAuthResult> {
      const result = await auth.passkey.addPasskey()
      return result.error ? failure(result.error) : done(undefined)
    },

    /** Whether a desktop sign-in code is still waiting, before showing it to approve. */
    async deviceRequest(
      userCode: string
    ): Promise<PortalAuthResult<'pending' | 'approved' | 'denied'>> {
      const result = await auth.device({ query: { user_code: userCode } })
      // An unknown or expired code is the only failure a person can act on: start again.
      if (result.error || !result.data) return { ok: false, failure: 'invalid-code' }
      const status = result.data.status
      return done(status === 'approved' || status === 'denied' ? status : 'pending')
    },

    async decideDevice(userCode: string, decision: 'approve' | 'deny'): Promise<PortalAuthResult> {
      const result = await auth.device[decision]({ userCode })
      return result.error || !result.data?.success
        ? { ok: false, failure: 'invalid-code' }
        : done(undefined)
    },

    async signOut(): Promise<void> {
      await auth.signOut()
    }
  }
}

export type PortalAuth = ReturnType<typeof createPortalAuth>
