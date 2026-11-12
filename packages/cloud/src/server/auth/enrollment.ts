import type { EnrollmentService } from '#cloud/admin/enrollment/service'
import { accountDeletionOptions } from '#cloud/server/account/deletion'
import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import type { BetterAuthOptions } from 'better-auth'
import type { Kysely } from 'kysely'

import type { AuthenticationEmailService } from './email'

/**
 * Who may join and when an account counts as enrolled: addresses are verified before an account
 * asks for approval or binds an approved invitation, and a closed deployment creates no accounts.
 */
export function enrollmentOptions(
  config: CloudServerConfig,
  database: Kysely<CloudDatabase>,
  enrollment: EnrollmentService,
  authenticationEmail: AuthenticationEmailService | undefined,
  emailChangeAvailable: boolean
): Pick<BetterAuthOptions, 'emailVerification' | 'user' | 'databaseHooks'> {
  async function enroll(user: { id: string; email: string; name: string }) {
    if (config.enrollmentMode === 'approval') {
      await enrollment.request({ email: user.email, name: user.name })
    }
    await enrollment.bindApprovedUser(user.email, user.id)
  }

  return {
    emailVerification:
      config.emailPasswordEnabled && authenticationEmail
        ? {
            expiresIn: config.emailVerificationExpiresIn,
            sendOnSignUp: true,
            // Signing in unverified only says so; people ask for another link with Send again.
            sendOnSignIn: false,
            autoSignInAfterVerification: true,
            // A change of address sends the link to the new address as `user.email`, on the
            // account it already confirmed; a new account has not confirmed one yet. This runs
            // inside sign-up's transaction, so it must not query the database itself.
            sendVerificationEmail: ({ user, url, token }) =>
              authenticationEmail.sendVerification({
                email: user.email,
                name: user.name,
                url,
                token,
                purpose: user.emailVerified ? 'change' : 'account'
              }),
            afterEmailVerification: async (user) => {
              await enrollment.followEmailChange(user.id, user.email)
              await enroll(user)
            }
          }
        : undefined,
    user: {
      changeEmail: { enabled: emailChangeAvailable },
      deleteUser: accountDeletionOptions(database),
      validateUserInfo: ({ source }) => {
        if (source.action === 'create-user' && config.enrollmentMode === 'closed') {
          return { error: 'enrollment_closed', errorDescription: 'Cloud enrollment is closed' }
        }
        return undefined
      }
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if (user.emailVerified) await enroll(user)
          }
        }
      }
    }
  }
}
