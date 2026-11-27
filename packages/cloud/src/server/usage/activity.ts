import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely, Transaction } from 'kysely'

type Executor = Kysely<CloudDatabase> | Transaction<CloudDatabase>

/** The UTC day a moment falls on, as the usage tables key it. */
const utcDay = (at: Date) => at.toISOString().slice(0, 10)

/**
 * Marks the account active on the day of `at`. Usage reads these marks rather than sign-ins and
 * revisions, which cleanup deletes; account deletion removes them with the account.
 */
export async function recordActiveAccount(
  executor: Executor,
  userId: string,
  at = new Date()
): Promise<void> {
  await executor
    .insertInto('dailyActiveAccount')
    .values({ day: utcDay(at), userId })
    .onConflict((conflict) => conflict.columns(['day', 'userId']).doNothing())
    .execute()
}

/** Counts one saved revision on the day of `at` and marks its author active. */
export async function recordSave(
  executor: Executor,
  userId: string,
  at = new Date()
): Promise<void> {
  await executor
    .insertInto('dailyRevisionCount')
    .values({ day: utcDay(at), count: 1 })
    .onConflict((conflict) =>
      conflict
        .column('day')
        .doUpdateSet((eb) => ({ count: eb('dailyRevisionCount.count', '+', 1) }))
    )
    .execute()
  await recordActiveAccount(executor, userId, at)
}
