import type { EnrollmentService } from '#cloud/admin/enrollment/service'
import { cloudLocaleSchema, isCloudLocale, type CloudLocale } from '#cloud/contract'
import { acceptedLocale } from '#cloud/email'
import { accountDeletionOptions } from '#cloud/server/account/deletion'
import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import type { BetterAuthOptions } from 'better-auth'
import type { Kysely } from 'kysely'
import * as v from 'valibot'

import type { AuthenticationEmailService } from './email'

/** The language an account being made chose, which Better Auth's types don't know it has. */
function accountLocale(user: object): CloudLocale | null {
  return 'locale' in user && isCloudLocale(user.locale) ? user.locale : null
}

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
) {
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
                purpose: user.emailVerified ? 'change' : 'account',
                // A new account isn't saved yet, so its language comes with it.
                locale: accountLocale(user)
              }),
            afterEmailVerification: async (user) => {
              await enrollment.followEmailChange(user.id, user.email)
              await enroll(user)
            }
          }
        : undefined,
    user: {
      additionalFields: {
        // The language Cloud writes to the account in: the app's, sent when signing up and
        // whenever the person changes it.
        locale: {
          type: 'string' as const,
          required: false,
          input: true,
          validator: { input: v.nullish(cloudLocaleSchema) }
        }
      },
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
          // An account the app didn't name a language for, as one made through Google or Apple,
          // takes the browser's.
          before: async (user, context) => {
            if (accountLocale(user)) return undefined
            const locale = acceptedLocale(context?.headers?.get('accept-language'))
            return locale ? { data: { ...user, locale } } : undefined
          },
          after: async (user) => {
            if (user.emailVerified) await enroll(user)
          }
        }
      }
    }
  } satisfies Pick<BetterAuthOptions, 'emailVerification' | 'user' | 'databaseHooks'>
}
