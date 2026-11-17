import type { CloudDatabase } from '#cloud/server/db'
import { APIError, type BetterAuthOptions } from 'better-auth'
import type { Kysely, Transaction } from 'kysely'

/**
 * Better Auth's store of keyed values. Its database hooks reach it inside the transaction that
 * creates an account, so a block kept there is read where the account would be made.
 */
export type SignInMethodBlockStore = {
  createVerificationValue(data: {
    identifier: string
    value: string
    expiresAt: Date
  }): Promise<unknown>
  findVerificationValue(identifier: string): Promise<{ value: string } | null>
  deleteVerificationByIdentifier(identifier: string): Promise<void>
}

/** A block stays until the owner adds the method back, or the account goes. */
const BLOCK_EXPIRES_AT = new Date(Date.UTC(9999, 11, 31))
const blockIdentifier = (userId: string, provider: string) =>
  `sign-in-method-block:${userId}:${provider}`

/** The sign-in method a removal took away: its provider (`credential` for a password) and id. */
export type RemovedSignInMethod = { provider: string; accountId: string }

/**
 * Removes one of an account's sign-in methods, by its row. The account's row is locked first, so
 * its owner unlinking one while an administrator removes another cannot leave it with none;
 * `also` runs in the same transaction, as an administrator's audit entry does.
 */
export async function removeSignInMethod(
  database: Kysely<CloudDatabase>,
  input: {
    userId: string
    methodId: string
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
    if (methods.length <= 1) {
      // Better Auth's own word, which the account routes already answer for.
      throw APIError.from('BAD_REQUEST', {
        code: 'FAILED_TO_UNLINK_LAST_ACCOUNT',
        message: 'An account keeps at least one way to sign in'
      })
    }
    await transaction.deleteFrom('account').where('id', '=', method.id).execute()
    await input.also?.(transaction, method.providerId)
    return { provider: method.providerId, accountId: method.accountId }
  })
}

/**
 * Keeps an identity an administrator removed from linking itself back: Google and Apple link to
 * an account by its email on their own, so a lost Google account would otherwise return at its
 * next sign-in. A password has nothing to link.
 */
export async function blockSignInMethod(
  store: SignInMethodBlockStore,
  userId: string,
  method: RemovedSignInMethod
): Promise<void> {
  if (method.provider === 'credential') return
  const identifier = blockIdentifier(userId, method.provider)
  await store.deleteVerificationByIdentifier(identifier)
  await store.createVerificationValue({
    identifier,
    value: method.accountId,
    expiresAt: BLOCK_EXPIRES_AT
  })
}

/** Lets the owner add back a provider an administrator removed, from their security page. */
export async function allowSignInMethod(
  store: SignInMethodBlockStore,
  userId: string,
  provider: string
): Promise<void> {
  await store.deleteVerificationByIdentifier(blockIdentifier(userId, provider))
}

/** Whether a sign-in may link `account`: not an identity an administrator removed from it. */
export async function signInMethodAllowed(
  store: SignInMethodBlockStore,
  account: { userId: string; providerId: string; accountId: string }
): Promise<boolean> {
  const block = await store.findVerificationValue(
    blockIdentifier(account.userId, account.providerId)
  )
  return block?.value !== account.accountId
}

/** Refuses to link an identity an administrator removed, however its sign-in tries to. */
export const signInMethodHooks: NonNullable<BetterAuthOptions['databaseHooks']> = {
  account: {
    create: {
      async before(account, context) {
        const store = context?.context.internalAdapter
        // `undefined` lets Better Auth create the account as it is; `false` refuses it.
        return store && !(await signInMethodAllowed(store, account)) ? false : undefined
      }
    }
  }
}

/**
 * What the auth adapter does with sign-in methods: link one, which also lifts an administrator's
 * block on that provider, unlink one through `removeSignInMethod`, and block one.
 */
export function signInMethodActions(options: {
  database: Kysely<CloudDatabase>
  store: () => Promise<SignInMethodBlockStore>
  freshSession: (headers: Headers) => Promise<{ user: { id: string } }>
  link: (
    headers: Headers,
    body: {
      provider: 'google' | 'apple'
      callbackURL: string
      errorCallbackURL: string
      disableRedirect: true
    }
  ) => Promise<{ url: string }>
}) {
  return {
    async startSocialLink(
      headers: Headers,
      input: { provider: 'google' | 'apple'; callbackURL: string }
    ): Promise<string> {
      const session = await options.freshSession(headers)
      await allowSignInMethod(await options.store(), session.user.id, input.provider)
      const response = await options.link(headers, {
        provider: input.provider,
        callbackURL: input.callbackURL,
        errorCallbackURL: input.callbackURL,
        disableRedirect: true
      })
      return response.url
    },
    async unlinkAuthenticationMethod(headers: Headers, methodId: string): Promise<void> {
      const session = await options.freshSession(headers)
      await removeSignInMethod(options.database, { userId: session.user.id, methodId })
    },
    async blockSignInMethod(userId: string, method: RemovedSignInMethod): Promise<void> {
      await blockSignInMethod(await options.store(), userId, method)
    }
  }
}
