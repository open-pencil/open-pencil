import { createCloudAuthClient } from '@open-pencil/cloud/client'
import type { CloudDiscovery } from '@open-pencil/cloud/contract'

export type CredentialAuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_verified'
  | 'password_too_short'
  | 'password_too_long'
  | 'invalid_token'
  | 'mfa_required'
  | 'rate_limited'
  | 'unknown'

export class CredentialAuthError extends Error {
  override readonly name = 'CredentialAuthError'
  readonly code: CredentialAuthErrorCode

  constructor(code: CredentialAuthErrorCode) {
    super(`Credential authentication failed: ${code}`)
    this.code = code
  }
}

type BetterAuthError = { code?: string; message?: string; status?: number }

function credentialError(error: BetterAuthError | null | undefined): CredentialAuthError {
  if (error?.status === 429) return new CredentialAuthError('rate_limited')
  const code = error?.code ?? ''
  if (code === 'INVALID_EMAIL_OR_PASSWORD') return new CredentialAuthError('invalid_credentials')
  if (code === 'EMAIL_NOT_VERIFIED') return new CredentialAuthError('email_not_verified')
  if (code === 'PASSWORD_TOO_SHORT') return new CredentialAuthError('password_too_short')
  if (code === 'PASSWORD_TOO_LONG') return new CredentialAuthError('password_too_long')
  if (code === 'INVALID_TOKEN') return new CredentialAuthError('invalid_token')
  if (code === 'mfa_required') return new CredentialAuthError('mfa_required')
  return new CredentialAuthError('unknown')
}

export function createCredentialAuthService(
  discovery: CloudDiscovery,
  options: { captchaResponse?: string } = {}
) {
  const auth = createCloudAuthClient(discovery, options)
  return {
    async signIn(input: { email: string; password: string; rememberMe: boolean }) {
      const result = await auth.signIn.email(input)
      if (result.error) throw credentialError(result.error)
      if ('twoFactorRedirect' in result.data && result.data.twoFactorRedirect === true) {
        return { twoFactorRequired: true as const }
      }
      return result.data
    },
    async signUp(input: { name: string; email: string; password: string; callbackURL: string }) {
      const result = await auth.signUp.email(input)
      if (result.error) throw credentialError(result.error)
      return result.data
    },
    async resendVerification(email: string, callbackURL: string) {
      const result = await auth.sendVerificationEmail({ email, callbackURL })
      if (result.error) throw credentialError(result.error)
      return result.data
    },
    async requestPasswordReset(email: string, redirectTo: string) {
      const result = await auth.requestPasswordReset({ email, redirectTo })
      if (result.error) throw credentialError(result.error)
      return result.data
    },
    async resetPassword(newPassword: string, token: string) {
      const result = await auth.resetPassword({ newPassword, token })
      if (result.error) throw credentialError(result.error)
      return result.data
    }
  }
}
