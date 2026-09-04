import { cloudAdminAPI, CloudAdminAPIError } from '#admin/api/client'

export type AccountSecurityErrorCode =
  | 'current_password_invalid'
  | 'password_too_short'
  | 'password_too_long'
  | 'last_method'
  | 'session_not_fresh'
  | 'unknown'

export class AccountSecurityError extends Error {
  override readonly name = 'AccountSecurityError'
  readonly code: AccountSecurityErrorCode

  constructor(code: AccountSecurityErrorCode) {
    super(`Account security request failed: ${code}`)
    this.code = code
  }
}

function securityError(error: unknown): AccountSecurityError {
  if (!(error instanceof CloudAdminAPIError)) return new AccountSecurityError('unknown')
  if (error.code === 'current_password_invalid') {
    return new AccountSecurityError('current_password_invalid')
  }
  if (error.code === 'password_too_short') return new AccountSecurityError('password_too_short')
  if (error.code === 'password_too_long') return new AccountSecurityError('password_too_long')
  if (error.code === 'last_authentication_method') return new AccountSecurityError('last_method')
  if (error.code === 'session_not_fresh') return new AccountSecurityError('session_not_fresh')
  return new AccountSecurityError('unknown')
}

export async function changeAccountPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  try {
    await cloudAdminAPI.changePassword(currentPassword, newPassword)
  } catch (error) {
    throw securityError(error)
  }
}

export async function unlinkAccountMethod(methodId: string): Promise<void> {
  try {
    await cloudAdminAPI.unlinkAuthenticationMethod(methodId)
  } catch (error) {
    throw securityError(error)
  }
}

export async function startAccountSocialLink(
  provider: 'google' | 'apple',
  callbackURL: string
): Promise<void> {
  try {
    const response = await cloudAdminAPI.linkSocial(provider, callbackURL)
    globalThis.location.assign(response.url)
  } catch (error) {
    throw securityError(error)
  }
}
