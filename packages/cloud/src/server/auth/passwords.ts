import type { CloudServerConfig } from '#cloud/server/config'
import type { BetterAuthOptions } from 'better-auth'

import type { AuthenticationEmailService } from './email'

/**
 * Signing in with an email and password, when the deployment allows it: a verified address, the
 * configured password lengths, and mail about resets when the deployment sends email.
 */
export function passwordOptions(
  config: CloudServerConfig,
  authenticationEmail: AuthenticationEmailService | undefined
): BetterAuthOptions['emailAndPassword'] {
  if (!config.emailPasswordEnabled) return undefined
  return {
    enabled: true,
    disableSignUp: !config.emailPasswordSignUpEnabled,
    requireEmailVerification: true,
    minPasswordLength: config.emailPasswordMinimumLength,
    maxPasswordLength: config.emailPasswordMaximumLength,
    autoSignIn: false,
    resetPasswordTokenExpiresIn: config.passwordResetExpiresIn,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: authenticationEmail
      ? ({ user, url, token }) =>
          authenticationEmail.sendPasswordReset({
            email: user.email,
            name: user.name,
            url,
            token
          })
      : undefined,
    onPasswordReset: authenticationEmail
      ? ({ user }) =>
          authenticationEmail.sendPasswordChanged({
            email: user.email,
            name: user.name,
            userId: user.id,
            url: config.publicURL
          })
      : undefined
  }
}
