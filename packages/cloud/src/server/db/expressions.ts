import { sql, type Expression, type Transaction } from 'kysely'

import type { CloudDatabase } from './tables'

export const CURRENT_TIMESTAMP = sql<Date>`current_timestamp`
export const EMPTY_JSON_OBJECT = sql`'{}'::jsonb`

const CHECK_VALUE_PATTERN = /^[a-z][a-z0-9-]*$/

export function checkColumnIn(column: string, values: readonly string[]): Expression<boolean> {
  if (values.length === 0 || values.some((value) => !CHECK_VALUE_PATTERN.test(value))) {
    throw new Error('Check constraint values must be non-empty lowercase identifiers')
  }
  return sql<boolean>`${sql.ref(column)} in (${sql.join(values.map((value) => sql.lit(value)))})`
}

/**
 * Holds a lock named `key` until the transaction ends, for a check and a write that must not
 * interleave with another transaction's, such as reserving storage from an account's allowance,
 * which spans rows no single one of which could be locked for it.
 */
export async function lockForTransaction(
  transaction: Transaction<CloudDatabase>,
  key: string
): Promise<void> {
  await sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`.execute(transaction)
}
