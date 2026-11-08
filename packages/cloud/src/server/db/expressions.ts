import { sql, type Expression, type Kysely, type Transaction } from 'kysely'

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

/**
 * Renames `from` to `to` with its primary key, when `from` exists and `to` does not, as a table
 * kept outside migrations needs before the migrator that keeps it runs, such as a migration
 * history renamed with its owner. Running it again, or from two processes at once, changes nothing.
 */
export async function renameTableOnce<Database>(
  database: Kysely<Database>,
  from: string,
  to: string
): Promise<void> {
  await sql`
    do $$
    begin
      -- Held until this statement's transaction ends, so a second process waits and then finds
      -- the table already renamed.
      perform pg_advisory_xact_lock(hashtextextended(${sql.lit(`rename-table:${to}`)}, 0));
      if to_regclass(${sql.lit(from)}) is not null and to_regclass(${sql.lit(to)}) is null then
        execute format('alter table %I rename to %I', ${sql.lit(from)}, ${sql.lit(to)});
        execute format(
          'alter table %I rename constraint %I to %I',
          ${sql.lit(to)},
          ${sql.lit(`${from}_pkey`)},
          ${sql.lit(`${to}_pkey`)}
        );
      end if;
    end
    $$
  `.execute(database)
}
