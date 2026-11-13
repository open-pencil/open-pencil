import { checkColumnIn, CURRENT_TIMESTAMP } from '#cloud/server/db/expressions'
import type { ColumnDefinitionBuilder, CreateTableBuilder, Kysely } from 'kysely'

/**
 * What Cloud's migrations build tables with. Names follow PostgreSQL's own: `<table>_pkey`,
 * `<table>_<columns>_key` for unique, `<table>_<columns>_fkey`, and `<table>_<column>_check`;
 * indexes are `<table>_<columns>_idx`. Account IDs are text, since Better Auth's tables come after
 * Cloud's (see `migrateCloudDatabase`), and never foreign keys.
 */

export const now = (column: ColumnDefinitionBuilder) =>
  column.notNull().defaultTo(CURRENT_TIMESTAMP)
export const required = (column: ColumnDefinitionBuilder) => column.notNull()

export const PERMISSIONS = ['view', 'edit']
export const ROLES = ['admin', 'editor', 'viewer']

/** What every emailed invitation keeps: whom it went to, its access, its secret, and its life. */
export function withInvitation<Table extends string>(
  table: CreateTableBuilder<Table>,
  access: 'permission' | 'role'
) {
  return table
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('email_normalized', 'text', required)
    .addColumn(access, 'text', required)
    .addColumn('token_hash', 'text', required)
    .addColumn('invited_by', 'text', required)
    .addColumn('invited_at', 'timestamptz', now)
    .addColumn('expires_at', 'timestamptz', required)
    .addColumn('accepted_at', 'timestamptz')
    .addColumn('revoked_at', 'timestamptz')
}

/** Text columns that take one of a few values, as `[table, column, values]`. */
export async function addChecks(
  database: Kysely<unknown>,
  checks: readonly (readonly [table: string, column: string, values: readonly string[]])[]
): Promise<void> {
  for (const [table, column, values] of checks) {
    await database.schema
      .alterTable(table)
      .addCheckConstraint(`${table}_${column}_check`, checkColumnIn(column, values))
      .execute()
  }
}

/**
 * Replaces the values a column may take, as `addChecks` named them, such as when a release adds
 * a kind the previous one never writes.
 */
export async function replaceChecks(
  database: Kysely<unknown>,
  checks: readonly (readonly [table: string, column: string, values: readonly string[]])[]
): Promise<void> {
  for (const [table, column] of checks) {
    await database.schema.alterTable(table).dropConstraint(`${table}_${column}_check`).execute()
  }
  await addChecks(database, checks)
}

/** Lookups beyond primary keys and unique columns, as `[table, columns]`; `desc` sorts newest first. */
export async function addIndexes(
  database: Kysely<unknown>,
  indexes: readonly (readonly [table: string, columns: readonly string[]])[]
): Promise<void> {
  for (const [table, columns] of indexes) {
    const name = columns.map((column) => column.split(' ')[0]).join('_')
    await database.schema
      .createIndex(`${table}_${name}_idx`)
      .on(table)
      .columns([...columns])
      .execute()
  }
}

/** Drops a migration's tables, last created first. */
export async function dropTables(
  database: Kysely<unknown>,
  tables: readonly string[]
): Promise<void> {
  for (const table of tables.toReversed()) {
    await database.schema.dropTable(table).ifExists().cascade().execute()
  }
}
