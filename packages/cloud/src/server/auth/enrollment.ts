import type { EnrollmentService } from '#cloud/admin/enrollment/service'
import { cloudLanguageTagSchema } from '#cloud/contract'
import { acceptedLocale, emailLocale, isEmailLocale, type EmailLocale } from '#cloud/email'
import { accountDeletionOptions } from '#cloud/server/account/deletion'
import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import type { BetterAuthOptions } from 'better-auth'
import type { Kysely } from 'kysely'
import * as v from 'valibot'

import type { AuthenticationEmailService } from './email'

/** The language an account writes in, which Better Auth's types don't know it has. */
function accountLocale(user: object): EmailLocale | null {
  return 'locale' in user && isEmailLocale(user.locale) ? user.locale : null
}

/** The language tag the app sent, if any, before it's matched to one Cloud writes in. */
function languageTag(user: object): string | null {
  return 'locale' in user && typeof user.locale === 'string' ? user.locale : null
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
                // The account carries its language, so nothing is looked up in the transaction.
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
        // whenever the person changes it, as the nearest language Cloud has (the hooks below).
        locale: {
          type: 'string' as const,
          required: false,
          input: true,
          validator: { input: v.nullish(cloudLanguageTagSchema) }
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
          // The app's language, or for an account it didn't name one for, as one made through
          // Google or Apple, the browser's. A language Cloud doesn't write in reads English.
          before: async (user, context) => {
            const tag = languageTag(user)
            const locale = tag
              ? emailLocale([tag])
              : acceptedLocale(context?.headers?.get('accept-language'))
            return { data: { ...user, locale } }
          },
          after: async (user) => {
            if (user.emailVerified) await enroll(user)
          }
        },
        update: {
          // Whoever changes it, Cloud keeps the nearest language it writes in, or English.
          before: async (user) => {
            if (!('locale' in user)) return undefined
            const tag = languageTag(user)
            return { data: { ...user, locale: emailLocale(tag ? [tag] : []) } }
          }
        }
      }
    }
  } satisfies Pick<BetterAuthOptions, 'emailVerification' | 'user' | 'databaseHooks'>
}
