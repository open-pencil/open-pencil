import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import { APIError, type BetterAuthOptions } from 'better-auth'
import { getOAuthState } from 'better-auth/api'
import type { Kysely, Transaction } from 'kysely'

/**
 * An administrator's removal of a Google or Apple identity is kept as one of Better Auth's
 * verification values: its database hooks read them inside the transaction that would create the
 * account, and the removal writes it in its own, so the two cannot come apart.
 */
const BLOCK_EXPIRES_AT = new Date(Date.UTC(9999, 11, 31))
const blockIdentifier = (userId: string, provider: string) =>
  `sign-in-method-block:${userId}:${provider}`

/** Better Auth's store of keyed values, as its database hooks are handed it. */
export type SignInMethodBlockStore = {
  findVerificationValue(identifier: string): Promise<{ value: string } | null>
  deleteVerificationByIdentifier(identifier: string): Promise<void>
}

/**
 * The providers this server signs in with now, `credential` for a password. A method linked before
 * its provider was turned off stays on the account but no longer lets anyone in.
 */
export function signInProviders(config: CloudServerConfig): ReadonlySet<string> {
  const providers = new Set<string>()
  if (config.emailPasswordEnabled) providers.add('credential')
  if (config.googleClientId && config.googleClientSecret) providers.add('google')
  if (config.appleClientId) providers.add('apple')
  return providers
}

/** The sign-in method a removal took away: its provider (`credential` for a password). */
export type RemovedSignInMethod = { provider: string }

/**
 * Removes one of an account's sign-in methods, by its row. The account's row is locked first, so
 * its owner unlinking one while an administrator removes another cannot leave it with none. An
 * administrator's removal (`block`) also keeps that Google or Apple identity from linking itself
 * back by the account's email; `also` runs in the same transaction, as their audit entry does.
 * With `providers`, only methods whose provider is turned on count as a way still in.
 */
export async function removeSignInMethod(
  database: Kysely<CloudDatabase>,
  input: {
    userId: string
    methodId: string
    providers?: ReadonlySet<string>
    block?: boolean
    also?: (transaction: Transaction<CloudDatabase>, provider: string) => Promise<void>
  }
): Promise<RemovedSignInMethod> {
  return database.transaction().execute(async (transaction) => {
    await transaction
      .selectFrom('user')
      .select('id')
      .where('id', '=', input.userId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const methods = await transaction
      .selectFrom('account')
      .select(['id', 'providerId', 'accountId'])
      .where('userId', '=', input.userId)
      .execute()
    const method = methods.find((candidate) => candidate.id === input.methodId)
    if (!method) {
      throw APIError.from('NOT_FOUND', { code: 'ACCOUNT_NOT_FOUND', message: 'No such method' })
    }
    const counts = (provider: string) => !input.providers || input.providers.has(provider)
    const others = methods.filter((candidate) => candidate.id !== method.id)
    // Taking away a provider that is off changes nothing; the last working one has to stay.
    if (
      others.length === 0 ||
      (counts(method.providerId) && !others.some((other) => counts(other.providerId)))
    ) {
      // Better Auth's own word, which the account routes already answer for.
      throw APIError.from('BAD_REQUEST', {
        code: 'FAILED_TO_UNLINK_LAST_ACCOUNT',
        message: 'An account keeps at least one way to sign in'
      })
    }
    await transaction.deleteFrom('account').where('id', '=', method.id).execute()
    if (input.block && method.providerId !== 'credential') {
      const identifier = blockIdentifier(input.userId, method.providerId)
      await transaction.deleteFrom('verification').where('identifier', '=', identifier).execute()
      await transaction
        .insertInto('verification')
        .values({
          id: crypto.randomUUID(),
          identifier,
          value: method.accountId,
          expiresAt: BLOCK_EXPIRES_AT,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .execute()
    }
    await input.also?.(transaction, method.providerId)
    return { provider: method.providerId }
  })
}

/**
 * Whether a sign-in may create `account`: not an identity an administrator removed from that
 * person, unless that person is linking it again from their own security page (`linkingUserId`,
 * which Better Auth carries from the request that started the link).
 */
export async function signInMethodAllowed(
  store: SignInMethodBlockStore,
  account: { userId: string; providerId: string; accountId: string },
  linkingUserId: () => Promise<string | null>
): Promise<boolean> {
  const block = await store.findVerificationValue(
    blockIdentifier(account.userId, account.providerId)
  )
  if (block?.value !== account.accountId) return true
  return (await linkingUserId()) === account.userId
}

/** The person a provider callback links an identity to, when it is a link they started. */
async function linkingUserId(): Promise<string | null> {
  // Outside a provider callback there is no sign-in state, and nothing is being linked.
  const state = await getOAuthState().catch(() => null)
  return state?.link?.userId ?? null
}

/**
 * Refuses to create an identity an administrator removed, however a sign-in tries to, and lifts
 * the block once its owner has linked it again.
 */
export const signInMethodHooks: NonNullable<BetterAuthOptions['databaseHooks']> = {
  account: {
    create: {
      async before(account, context) {
        const store = context?.context.internalAdapter
        // `undefined` lets Better Auth create the account as it is; `false` refuses it.
        return store && !(await signInMethodAllowed(store, account, linkingUserId))
          ? false
          : undefined
      },
      async after(account, context) {
        const store = context?.context.internalAdapter
        if (store && (await linkingUserId()) === account.userId) {
          await store.deleteVerificationByIdentifier(
            blockIdentifier(account.userId, account.providerId)
          )
        }
      }
    }
  }
}
